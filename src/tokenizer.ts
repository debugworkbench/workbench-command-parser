/**
 * A tokenizer for command strings. This handles processing double quotes, including
 * escaped double quotes within a string.
 *
 * To use this module:
 *
 * ```
 * import { tokenize } from 'workbench-command-parser/tokenizer';
 * const tokens = tokenize('help show interface');
 * ```
 */

/**
 * A position within a string.
 */
export class SourceOffset {
  readonly char: number;
  readonly line: number;
  readonly column: number;

  constructor (char: number, line: number, column: number) {
    this.char = char;
    this.line = line;
    this.column = column;
  }
}

/**
 * A range within a string.
 */
export class SourceLocation {
  readonly startOffset: SourceOffset;
  readonly endOffset: SourceOffset;

  constructor (startChar: number, startLine: number, startColumn: number,
               endChar: number, endLine: number, endColumn: number) {
    this.startOffset = new SourceOffset(startChar, startLine, startColumn);
    this.endOffset = new SourceOffset(endChar, endLine, endColumn);
  }
}

/**
 *
 */
export enum TokenType {
  /** Internal usage only. @private */
  Invalid,
  /** The token of type `Whitespace` represents whitespace and not a word. */
  Whitespace,
  /** The token of type `Word` represents a word within the string. This
      takes double quotes into account */
  Word
}

/**
 * A token from the source string. It will either represent a word within
 * the string or whitespace.
 */
export class CommandToken {
  /**
   * The text of the token.
   */
  readonly text: string;
  /**
   * The type of the token.
   */
  readonly tokenType: TokenType;
  /**
   * The location of the token within the source string.
   */
  readonly location: SourceLocation;

  constructor (text: string, tokenType: TokenType, location: SourceLocation) {
    this.text = text;
    this.tokenType = tokenType;
    this.location = location;
  }
}

enum State {
  Initial,
  Special,
  Whitespace,
  Doublequote,
  DoublequoteBackslash,
  Word,
  WordBackslash
}

/**
 * Given a command string, return the list of tokens that make up
 * the contents of that string.
 */
export function tokenize (text: string): CommandToken[] {
  const tokens: CommandToken[] = [];

  let state: State;
  let tokenType: TokenType;
  let tokenStart: number;
  let tokenEnd: number;

  const reset = (): void => {
    tokenType = TokenType.Invalid;
    tokenStart = 0;
    tokenEnd = 0;
    state = State.Initial;
  };
  const reduce = (): void => {
    const tokenText = text.slice(tokenStart, tokenEnd + 1);
    const sourceLocation = new SourceLocation(tokenStart, 0, tokenStart, tokenEnd, 0, tokenEnd);
    const token = new CommandToken(tokenText, tokenType, sourceLocation);
    tokens.push(token);
    reset();
  };
  // Initialize
  reset();
  for (let offset = 0; offset < text.length; offset++) {
    const c = text[offset];
    function shift(nextState: State) {
      recognize(nextState);
      tokenEnd = offset;
      state = nextState;
    }
    function recognize(nextState: State) {
      if (tokenType === TokenType.Invalid) {
        let newTokenType = TokenType.Word;
        if (nextState === State.Whitespace) {
          newTokenType = TokenType.Whitespace;
        }
        tokenType = newTokenType;
        tokenStart = offset;
      }
    }
    function special() {
      shift(State.Special);
      reduce();
    }
    function initial() {
      if (/\s/.test(c)) {
        shift(State.Whitespace);
      } else if (c === ';') {
        special();
      } else if (c === '?') {
        special();
      } else if (c === '|') {
        special();
      } else if (c === '"') {
        shift(State.Doublequote);
      } else if (c === '\\') {
        recognize(State.Word);
        shift(State.WordBackslash);
      } else if (/\S/.test(c)) {
        shift(State.Word);
      } else {
        throw(new Error("Invalid character."));
      }
    }

    switch (state) {
      case State.Initial:
        initial();
        break;
      case State.Whitespace:
        if (/\s/.test(c)) {
          shift(State.Whitespace);
        } else {
          reduce();
          initial();
        }
        break;
      case State.Word:
        if (/\s/.test(c)) {
          reduce();
          shift(State.Whitespace);
        } else if (c === ';') {
          reduce();
          special();
        } else if (c === '|') {
          reduce();
          special();
        } else if (c === '"') {
          reduce();
          shift(State.Doublequote);
        } else if (c === '\\') {
          shift(State.WordBackslash);
        } else if (/\S/.test(c)) {
          shift(State.Word);
        } else {
          throw(new Error("Character not allowed here."));
        }
        break;
      case State.WordBackslash:
        if (/S/.test(c)) {
          shift(State.Word);
        } else {
          throw(new Error("Character not allowed here."));
        }
        break;
      case State.Doublequote:
        if (c === '"') {
          shift(State.Doublequote);
          reduce();
        } else if (c === '\\') {
          shift(State.DoublequoteBackslash);
        } else {
          shift(State.Doublequote);
        }
        break;
      case State.DoublequoteBackslash:
        if (/\S/.test(c)) {
          shift(State.Doublequote);
        } else {
          throw(new Error("Character not allowed here."));
        }
    }
  }

  // Handle epsilon / end of source
  function invalid(errorText: string) {
    throw(errorText);
  }
  switch (state) {
    case State.Initial:
      break;
    case State.Word:
    case State.Whitespace:
      reduce();
      break;
    case State.WordBackslash:
      break;
    case State.Doublequote:
      invalid("Escaping backslash at end of file.");
    case State.DoublequoteBackslash:
      invalid("Unclosed double quote at end of file.");
      break;
    default:
      invalid("BUG: Unknown lexer state at end of file.");
      break;
  }

  return tokens;
}
