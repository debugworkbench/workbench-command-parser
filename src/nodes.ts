import { CommandParser, Completion, makeCompletion, ParameterNode, ParserNode } from './parser';
import { CommandToken } from './tokenizer';

/**
 * Simple string parameter.
 */
export class StringParameterNode extends ParameterNode {
}

/**
 * Flag parameters.
 */
export class FlagNode extends ParameterNode {
  public helpSymbol (): string {
    return this.name;
  }

  public helpText (): string {
    return this.help || "Flag";
  }

  /**
   * Convert to a ``true`` ``boolean`` value.
   */
  convert (parser: CommandParser, token: CommandToken): any {
    return true;
  }

  /**
   * Parameters complete only to themselves.
   */
  complete (parser: CommandParser, token?: CommandToken): Completion {
    return makeCompletion(this, token, {
                            exhaustive: true,
                            completeOptions: [this.symbol]
                          });
  }
}
