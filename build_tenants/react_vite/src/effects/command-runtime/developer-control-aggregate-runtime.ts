import type {
  DeveloperControlAggregateCommand,
  DeveloperControlAggregateMessage,
} from "../../capabilities/host/aggregate";
import {
  commandEnvelopeSchema,
  commandResultSchema,
} from "@odd-manager/developer-control-contracts";
import { interpretAssuranceAttentionCommand } from "./assurance-attention-command-runtime";
import { interpretBuildControlCommand } from "./build-control-command-runtime";
import { interpretBuildPortfolioCommand } from "./build-portfolio-command-runtime";
import { interpretDeveloperControlCommand } from "./developer-control-command-runtime";
import { interpretSpecificationProposalCommand } from "./specification-proposal-command-runtime";

function capabilityMessageFailure(message: unknown) {
  if (
    typeof message !== "object"
    || message === null
    || !("type" in message)
    || typeof message.type !== "string"
    || !message.type.endsWith("failed")
    || !("error" in message)
    || typeof message.error !== "string"
    || message.error.length === 0
  ) return null;
  return {
    failureKind: message.type,
    error: message.error,
  };
}

function admittedCapabilityResult<
  Command extends Extract<DeveloperControlAggregateCommand, { command: unknown }>,
  Message,
>(command: Command, message: Message) {
  if (!command.envelope) return { message };
  const envelope = commandEnvelopeSchema.parse(command.envelope);
  if (
    envelope.commandId !== command.command.commandId
    || envelope.correlationId !== command.command.correlationId
    || envelope.kind !== command.command.type
  ) {
    throw new Error(`Aggregate command envelope does not match ${command.aggregateCommandId}.`);
  }
  const resultBase = {
    commandId: envelope.commandId,
    correlationId: envelope.correlationId,
    completedAt: new Date().toISOString(),
    sourceRefs: [`odd-manager://aggregate/${command.type}`],
  };
  const failure = capabilityMessageFailure(message);
  const commandResult = commandResultSchema.parse(failure
    ? {
        ...resultBase,
        status: "failed",
        failureKind: failure.failureKind,
        error: failure.error,
        retryable: false,
        value: message,
      }
    : {
        ...resultBase,
        status: "succeeded",
        value: message,
      });
  return { envelope, commandResult, message };
}

export async function interpretDeveloperControlAggregateCommand(
  command: DeveloperControlAggregateCommand,
  activateProject: (projectRoot: string) => void,
): Promise<DeveloperControlAggregateMessage> {
  try {
    if (command.type === "aggregate.interpret-host") {
      const delivery = admittedCapabilityResult(
        command,
        await interpretDeveloperControlCommand(command.command),
      );
      return {
        type: "aggregate/command-resolved",
        aggregateCommandId: command.aggregateCommandId,
        result: {
          type: "host",
          ...delivery,
        },
      };
    }
    if (command.type === "aggregate.interpret-portfolio") {
      const delivery = admittedCapabilityResult(
        command,
        await interpretBuildPortfolioCommand(command.command),
      );
      return {
        type: "aggregate/command-resolved",
        aggregateCommandId: command.aggregateCommandId,
        result: {
          type: "portfolio",
          ...delivery,
        },
      };
    }
    if (command.type === "aggregate.interpret-proposal") {
      const delivery = admittedCapabilityResult(
        command,
        await interpretSpecificationProposalCommand(command.command),
      );
      return {
        type: "aggregate/command-resolved",
        aggregateCommandId: command.aggregateCommandId,
        result: {
          type: "proposal",
          ...delivery,
        },
      };
    }
    if (command.type === "aggregate.interpret-build") {
      const delivery = admittedCapabilityResult(
        command,
        await interpretBuildControlCommand(command.command),
      );
      return {
        type: "aggregate/command-resolved",
        aggregateCommandId: command.aggregateCommandId,
        result: {
          type: "build",
          ...delivery,
        },
      };
    }
    if (command.type === "aggregate.interpret-assurance") {
      const delivery = admittedCapabilityResult(
        command,
        await interpretAssuranceAttentionCommand(command.command),
      );
      return {
        type: "aggregate/command-resolved",
        aggregateCommandId: command.aggregateCommandId,
        result: {
          type: "assurance",
          ...delivery,
        },
      };
    }
    activateProject(command.projectRoot);
    return {
      type: "aggregate/command-resolved",
      aggregateCommandId: command.aggregateCommandId,
      result: {
        type: "project-activated",
        projectRoot: command.projectRoot,
      },
    };
  } catch (caught) {
    return {
      type: "aggregate/command-failed",
      aggregateCommandId: command.aggregateCommandId,
      error: caught instanceof Error ? caught.message : String(caught),
    };
  }
}
