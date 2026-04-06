# Implements: REQ-R-ABG3-TRANSPORT
# Implements: REQ-P-QUAL
# Implements: REQ-P-QUAL-005
# Implements: REQ-P-QUAL-006
# Implements: REQ-P-QUAL-012
# Implements: REQ-P-QUAL-023
# Implements: REQ-P-QUAL-024
"""
transport — Subprocess transport for F_P actor invocations.

Architecture: F_D → subprocess → agent (ADR-022).
Supported agents: claude, codex, gemini.
ADR-027 failure classification: transport_failure, no_output, contract_failure.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable


AGENT_CALL_TIMEOUT = 300
AGENT_RETRY_COUNT = 2
AGENT_RETRY_BACKOFF = 5  # seconds
AGENT_PROBE_TIMEOUT = 60
AGENT_PROBE_EXPECTED_RESPONSE = "ABG_READY"
AGENT_PROBE_PROMPT = (
    "Return exactly this token on one line: ABG_READY. "
    "Do not inspect the workspace. Do not analyze files. Do not add commentary."
)


class AgentTransportError(Exception):
    """Agent transport failure — process crash, timeout, not installed."""

    def __init__(self, message: str, failure_class: str = "transport_failure"):
        super().__init__(message)
        self.failure_class = failure_class


@dataclass
class AgentResult:
    """Full outcome of an agent subprocess invocation."""
    stdout: str
    stderr: str
    returncode: int
    agent: str
    timed_out: bool = False
    failure_class: str | None = None

    @property
    def success(self) -> bool:
        return self.returncode == 0 and not self.timed_out


McpTransportError = AgentTransportError


@dataclass(frozen=True)
class AgentCliContract:
    """Resolved local transport contract for one agent CLI."""

    command: str
    args_template: tuple[str, ...]
    output_mode: str = "stdout"
    sanitize_env_prefixes: tuple[str, ...] = ()
    probe_prompt: str = AGENT_PROBE_PROMPT
    probe_expected_response: str = AGENT_PROBE_EXPECTED_RESPONSE
    probe_timeout: int = AGENT_PROBE_TIMEOUT
    call_timeout: int = AGENT_CALL_TIMEOUT
    retry_count: int = AGENT_RETRY_COUNT
    retry_backoff: int = AGENT_RETRY_BACKOFF

    def __post_init__(self) -> None:
        if not self.command:
            raise ValueError("AgentCliContract.command must be non-empty")
        if not self.args_template:
            raise ValueError("AgentCliContract.args_template must be non-empty")
        if self.output_mode not in {"stdout", "output_file"}:
            raise ValueError(
                "AgentCliContract.output_mode must be 'stdout' or 'output_file'"
            )
        if not any("{prompt}" in token for token in self.args_template):
            raise ValueError(
                "AgentCliContract.args_template must include a {prompt} placeholder"
            )
        if self.output_mode == "output_file" and not any(
            "{output_path}" in token for token in self.args_template
        ):
            raise ValueError(
                "AgentCliContract(output_mode='output_file') must include an "
                "{output_path} placeholder"
            )
        if self.probe_timeout <= 0:
            raise ValueError("AgentCliContract.probe_timeout must be positive")
        if self.call_timeout <= 0:
            raise ValueError("AgentCliContract.call_timeout must be positive")
        if self.retry_count < 0:
            raise ValueError("AgentCliContract.retry_count must be non-negative")
        if self.retry_backoff < 0:
            raise ValueError("AgentCliContract.retry_backoff must be non-negative")

    def cache_signature(self) -> tuple[Any, ...]:
        return (
            self.command,
            self.args_template,
            self.output_mode,
            self.sanitize_env_prefixes,
            self.probe_prompt,
            self.probe_expected_response,
            self.probe_timeout,
            self.call_timeout,
            self.retry_count,
            self.retry_backoff,
        )


_DEFAULT_AGENT_CONTRACTS: dict[str, AgentCliContract] = {
    "claude": AgentCliContract(
        command="claude",
        args_template=(
            "-p",
            "--output-format",
            "text",
            "--permission-mode",
            "bypassPermissions",
            "{prompt}",
        ),
        sanitize_env_prefixes=("CLAUDE",),
    ),
    "codex": AgentCliContract(
        command="codex",
        args_template=(
            "exec",
            "--full-auto",
            "--skip-git-repo-check",
            "-o",
            "{output_path}",
            "{prompt}",
        ),
        output_mode="output_file",
    ),
    "gemini": AgentCliContract(
        command="gemini",
        args_template=("-p", "{prompt}"),
    ),
}


def _mapping(value: Any) -> dict[str, Any]:
    if isinstance(value, Mapping):
        return dict(value)
    return {}


def _coerce_string_tuple(value: Any, *, label: str) -> tuple[str, ...]:
    if not isinstance(value, (list, tuple)):
        raise ValueError(f"{label} must be a list of strings")
    result: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item:
            raise ValueError(f"{label} must contain only non-empty strings")
        result.append(item)
    return tuple(result)


def _load_transport_contract_overrides(
    config: Mapping[str, Any] | None,
    *,
    work_folder: str | None,
) -> dict[str, Any]:
    config_map = _mapping(config)
    raw = config_map.get("transport_contract")
    if raw is None:
        return {}
    if isinstance(raw, Mapping):
        return dict(raw)
    if not isinstance(raw, str) or not raw.strip():
        raise ValueError(
            "transport_contract must be a mapping or a path/JSON string"
        )

    source = raw.strip()
    if source.startswith("{"):
        try:
            loaded = json.loads(source)
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"transport_contract JSON string is invalid: {exc}"
            ) from exc
        if not isinstance(loaded, Mapping):
            raise ValueError("transport_contract JSON must decode to an object")
        return dict(loaded)

    base = Path(work_folder or os.getcwd())
    contract_path = Path(source)
    if not contract_path.is_absolute():
        contract_path = (base / contract_path).resolve()
    try:
        loaded = json.loads(contract_path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise ValueError(
            f"transport_contract file {contract_path} could not be read: {exc}"
        ) from exc
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"transport_contract file {contract_path} is not valid JSON: {exc}"
        ) from exc
    if not isinstance(loaded, Mapping):
        raise ValueError(
            f"transport_contract file {contract_path} must contain a JSON object"
        )
    return dict(loaded)


def _resolve_agent_contract(
    agent: str,
    *,
    config: Mapping[str, Any] | None = None,
    work_folder: str | None = None,
) -> AgentCliContract:
    default = _DEFAULT_AGENT_CONTRACTS.get(agent)
    if default is None:
        raise ValueError(
            f"Unknown agent: {agent!r}. Supported: {sorted(_DEFAULT_AGENT_CONTRACTS)}"
        )

    overrides = _load_transport_contract_overrides(config, work_folder=work_folder)
    raw_override = overrides.get(agent)
    if raw_override is None:
        return default
    if not isinstance(raw_override, Mapping):
        raise ValueError(
            f"transport_contract override for agent {agent!r} must be an object"
        )

    override = dict(raw_override)
    command = default.command
    if "command" in override:
        value = override["command"]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(
                f"transport_contract[{agent!r}].command must be a non-empty string"
            )
        command = value.strip()

    args_template = default.args_template
    if "args" in override:
        args_template = _coerce_string_tuple(
            override["args"],
            label=f"transport_contract[{agent!r}].args",
        )

    output_mode = default.output_mode
    if "output_mode" in override:
        value = override["output_mode"]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(
                f"transport_contract[{agent!r}].output_mode must be a non-empty string"
            )
        output_mode = value.strip()

    sanitize_env_prefixes = default.sanitize_env_prefixes
    if "sanitize_env_prefixes" in override:
        sanitize_env_prefixes = _coerce_string_tuple(
            override["sanitize_env_prefixes"],
            label=f"transport_contract[{agent!r}].sanitize_env_prefixes",
        )

    probe_prompt = default.probe_prompt
    if "probe_prompt" in override:
        value = override["probe_prompt"]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(
                f"transport_contract[{agent!r}].probe_prompt must be a non-empty string"
            )
        probe_prompt = value

    probe_expected_response = default.probe_expected_response
    if "probe_expected_response" in override:
        value = override["probe_expected_response"]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(
                f"transport_contract[{agent!r}].probe_expected_response must be "
                "a non-empty string"
            )
        probe_expected_response = value

    def _override_int(
        key: str,
        fallback: int,
    ) -> int:
        if key not in override:
            return fallback
        value = override[key]
        if not isinstance(value, int):
            raise ValueError(
                f"transport_contract[{agent!r}].{key} must be an integer"
            )
        return value

    return AgentCliContract(
        command=command,
        args_template=args_template,
        output_mode=output_mode,
        sanitize_env_prefixes=sanitize_env_prefixes,
        probe_prompt=probe_prompt,
        probe_expected_response=probe_expected_response,
        probe_timeout=_override_int("probe_timeout", default.probe_timeout),
        call_timeout=_override_int("call_timeout", default.call_timeout),
        retry_count=_override_int("retry_count", default.retry_count),
        retry_backoff=_override_int("retry_backoff", default.retry_backoff),
    )


def has_agent(
    agent: str = "claude",
    *,
    config: Mapping[str, Any] | None = None,
    work_folder: str | None = None,
) -> bool:
    """Check if the named agent CLI is available on PATH."""
    try:
        command = _agent_command(agent, config=config, work_folder=work_folder)
    except ValueError:
        return False
    return shutil.which(command) is not None


def has_mcp_transport() -> bool:
    return has_agent("claude")


def _format_transport_output(result: subprocess.CompletedProcess[str]) -> str:
    stdout = result.stdout[:500].strip()
    stderr = result.stderr[:500].strip()
    parts: list[str] = []
    if stdout:
        parts.append(f"stdout: {stdout}")
    if stderr:
        parts.append(f"stderr: {stderr}")
    return "\n".join(parts)


def _agent_output_file(agent: str) -> Path:
    handle = tempfile.NamedTemporaryFile(
        prefix=f"abg_{agent}_",
        suffix=".txt",
        delete=False,
    )
    handle.close()
    return Path(handle.name)


def _read_optional_output(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def _run_agent_subprocess(
    *,
    agent: str,
    prompt: str,
    cwd: str,
    timeout: int,
    env: dict[str, str],
    contract: AgentCliContract,
) -> AgentResult:
    output_path: Path | None = None
    try:
        if contract.output_mode == "output_file":
            output_path = _agent_output_file(agent)
        args = _build_args(
            agent,
            prompt,
            output_path=output_path,
            contract=contract,
        )
        result = subprocess.run(
            args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env,
        )
        stdout = result.stdout
        if output_path is not None:
            captured = _read_optional_output(output_path).strip()
            if captured:
                stdout = captured
        return AgentResult(
            stdout=stdout,
            stderr=result.stderr,
            returncode=result.returncode,
            agent=agent,
        )
    except subprocess.TimeoutExpired:
        return AgentResult(
            stdout="",
            stderr=f"Agent '{agent}' timed out after {timeout}s.",
            returncode=-1,
            agent=agent,
            timed_out=True,
            failure_class="transport_failure",
        )
    finally:
        if output_path is not None:
            try:
                output_path.unlink()
            except OSError:
                pass


def probe_agent(
    agent: str = "claude",
    *,
    work_folder: str | None = None,
    timeout: int | None = None,
    config: Mapping[str, Any] | None = None,
) -> AgentResult:
    """
    Probe whether an installed agent is authenticated and callable.

    This is used by opt-in live qualification to skip cleanly when the CLI is
    present but not actually usable, for example when the user is logged out.
    The probe prompt must stay trivial so workspace bootloaders do not turn the
    readiness check into a substantive project task.
    """
    try:
        contract = _resolve_agent_contract(agent, config=config, work_folder=work_folder)
    except ValueError as exc:
        return AgentResult(
            stdout="",
            stderr=str(exc),
            returncode=-1,
            agent=agent,
            failure_class="policy_config_defect",
        )

    cmd = contract.command
    if not shutil.which(cmd):
        return AgentResult(
            stdout="",
            stderr=f"Agent '{agent}' not found (command: {cmd}). Install it or check PATH.",
            returncode=-1,
            agent=agent,
            failure_class="transport_failure",
        )

    resolved_timeout = timeout if isinstance(timeout, int) and timeout > 0 else contract.probe_timeout
    env = _sanitized_env(agent, contract=contract)
    result = _run_agent_subprocess(
        agent=agent,
        prompt=contract.probe_prompt,
        cwd=work_folder or os.getcwd(),
        timeout=resolved_timeout,
        env=env,
        contract=contract,
    )
    if result.timed_out:
        result.stderr = f"Agent '{agent}' probe timed out after {resolved_timeout}s."
        return result
    if result.returncode == 0 and result.stdout.strip() != contract.probe_expected_response:
        return AgentResult(
            stdout=result.stdout,
            stderr=(
                "Agent probe contract violated. "
                f"Expected exact response {contract.probe_expected_response!r}."
            ),
            returncode=-1,
            agent=agent,
        )
    return result


_AGENT_READY_CACHE: dict[tuple[str, str, tuple[Any, ...]], bool] = {}


def clear_agent_ready_cache() -> None:
    _AGENT_READY_CACHE.clear()


def agent_ready(
    agent: str = "claude",
    *,
    work_folder: str | None = None,
    config: Mapping[str, Any] | None = None,
) -> bool:
    """
    Return whether the agent is callable in the requested workspace.

    Successful probes are cached per `(agent, workspace)` to avoid repeated
    subprocess startup during live test discovery. Failures are not cached so a
    transient timeout or a newly repaired login state can recover immediately.
    """
    try:
        contract = _resolve_agent_contract(agent, config=config, work_folder=work_folder)
    except ValueError:
        return False

    cache_key = (agent, work_folder or os.getcwd(), contract.cache_signature())
    cached = _AGENT_READY_CACHE.get(cache_key)
    if cached is True:
        return True

    ready = probe_agent(agent, work_folder=work_folder, config=config).success
    if ready:
        _AGENT_READY_CACHE[cache_key] = True
    else:
        _AGENT_READY_CACHE.pop(cache_key, None)
    return ready


def call_agent(
    prompt: str,
    work_folder: str,
    *,
    agent: str = "claude",
    timeout: int | None = None,
    retries: int | None = None,
    config: Mapping[str, Any] | None = None,
) -> str:
    """Invoke an autonomous agent in a workspace via subprocess.

    Environment sanitization: For Claude Code, all CLAUDE* env vars are stripped
    to prevent the nesting guard hang.

    REQ-P-QUAL-024: Transient transport failures (timeout, nonzero exit) are
    retried up to `retries` times with backoff. Permanent failures (agent not
    installed) are not retried.

    Raises:
        AgentTransportError: if the agent times out, crashes, or is not installed.
    """
    try:
        contract = _resolve_agent_contract(agent, config=config, work_folder=work_folder)
    except ValueError as exc:
        raise AgentTransportError(
            str(exc),
            failure_class="policy_config_defect",
        ) from exc

    cmd = contract.command
    if not shutil.which(cmd):
        raise AgentTransportError(
            f"Agent '{agent}' not found (command: {cmd}). Install it or check PATH.",
            failure_class="transport_failure",
        )

    resolved_timeout = timeout if isinstance(timeout, int) and timeout > 0 else contract.call_timeout
    resolved_retries = retries if isinstance(retries, int) and retries >= 0 else contract.retry_count
    env = _sanitized_env(agent, contract=contract)

    last_error: AgentTransportError | None = None
    for attempt in range(1 + resolved_retries):
        if attempt > 0:
            import time
            time.sleep(contract.retry_backoff * attempt)

        result = _run_agent_subprocess(
            agent=agent,
            prompt=prompt,
            cwd=work_folder,
            timeout=resolved_timeout,
            env=env,
            contract=contract,
        )
        if result.timed_out:
            last_error = AgentTransportError(
                f"Agent '{agent}' timed out after {resolved_timeout}s in {work_folder} "
                f"(attempt {attempt + 1}/{1 + resolved_retries}).",
                failure_class="transport_failure",
            )
            continue

        if result.returncode != 0:
            last_error = AgentTransportError(
                f"Agent '{agent}' exited with code {result.returncode} "
                f"in {work_folder} (attempt {attempt + 1}/{1 + resolved_retries})."
                + (
                    "\n"
                    + "\n".join(
                        part
                        for part in (
                            f"stdout: {result.stdout[:500].strip()}" if result.stdout.strip() else "",
                            f"stderr: {result.stderr[:500].strip()}" if result.stderr.strip() else "",
                        )
                        if part
                    )
                    if (result.stdout.strip() or result.stderr.strip())
                    else ""
                ),
                failure_class="transport_failure",
            )
            continue

        return result.stdout

    raise last_error  # type: ignore[misc]


def dispatch_agent(
    prompt: str,
    work_folder: str,
    *,
    agent: str = "claude",
    timeout: int | None = None,
    config: Mapping[str, Any] | None = None,
) -> AgentResult:
    """Invoke an agent subprocess and return the full result.

    Unlike call_agent(), this never raises — all outcomes are captured in AgentResult.
    The caller can then classify substrate and payload-contract failure explicitly.
    """
    try:
        contract = _resolve_agent_contract(agent, config=config, work_folder=work_folder)
    except ValueError as exc:
        return AgentResult(
            stdout="",
            stderr=str(exc),
            returncode=-1,
            agent=agent,
            failure_class="policy_config_defect",
        )

    cmd = contract.command
    if not shutil.which(cmd):
        return AgentResult(
            stdout="",
            stderr=f"Agent '{agent}' not found (command: {cmd}). Install it or check PATH.",
            returncode=-1,
            agent=agent,
            failure_class="transport_failure",
        )

    resolved_timeout = timeout if isinstance(timeout, int) and timeout > 0 else contract.call_timeout
    env = _sanitized_env(agent, contract=contract)
    result = _run_agent_subprocess(
        agent=agent,
        prompt=prompt,
        cwd=work_folder,
        timeout=resolved_timeout,
        env=env,
        contract=contract,
    )
    if result.timed_out:
        result.stderr = f"Agent '{agent}' timed out after {resolved_timeout}s in {work_folder}."
    return result


def classify_failure(
    result: AgentResult,
    result_path: str | None = None,
    *,
    payload_validator: Callable[[Any], bool] | None = None,
) -> str | None:
    """Classify an agent invocation failure at the transport boundary.

    Returns None on success, or one of:
      transport_failure, no_output, contract_failure
    """
    if result.timed_out:
        return "transport_failure"

    if result.failure_class:
        return result.failure_class

    if result.returncode != 0:
        return "transport_failure"

    if not result_path:
        return None

    try:
        path = Path(result_path)
        if not path.exists():
            return "no_output"
        content = path.read_text(encoding="utf-8").strip()
        if not content:
            return "no_output"
        payload = json.loads(content)
        if payload_validator is not None and not payload_validator(payload):
            return "contract_failure"
    except json.JSONDecodeError:
        return "contract_failure"
    except OSError:
        return "no_output"

    return None

def _agent_command(
    agent: str,
    *,
    config: Mapping[str, Any] | None = None,
    work_folder: str | None = None,
) -> str:
    """Map agent identifier to CLI command."""
    return _resolve_agent_contract(
        agent,
        config=config,
        work_folder=work_folder,
    ).command


def _build_args(
    agent: str,
    prompt: str,
    *,
    output_path: Path | None = None,
    contract: AgentCliContract | None = None,
) -> list[str]:
    """Build the subprocess argument list for the given agent.

    REQ-P-QUAL-023: agent subprocess must have sufficient permissions to
    execute all tools required by the dispatch contract. For Claude Code,
    --permission-mode bypassPermissions ensures the agent can write artifacts
    without blocking on interactive permission dialogs.
    """
    resolved = contract or _resolve_agent_contract(agent)
    rendered = [resolved.command]
    for token in resolved.args_template:
        current = token.replace("{prompt}", prompt)
        if "{output_path}" in current:
            if output_path is None:
                raise ValueError(
                    f"{agent.capitalize()} transport requires an output_path"
                )
            current = current.replace("{output_path}", str(output_path))
        rendered.append(current)
    return rendered


def _sanitized_env(
    agent: str,
    *,
    contract: AgentCliContract | None = None,
) -> dict[str, str]:
    """Build a sanitized environment for subprocess launch.

    For Claude Code: strips all CLAUDE* env vars to prevent nesting hang.
    """
    env = os.environ.copy()
    resolved = contract or _resolve_agent_contract(agent)
    for prefix in resolved.sanitize_env_prefixes:
        for key in list(env):
            if key.startswith(prefix):
                del env[key]
    return env
