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
  char: number;
  line: number;
  column: number;

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
  startOffset: SourceOffset;
  endOffset: SourceOffset;

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
  private text_: string;
  private tokenType_: TokenType;
  private location_: SourceLocation;

  constructor (text: string, tokenType: TokenType, location: SourceLocation) {
    this.text_ = text;
    this.tokenType_ = tokenType;
    this.location_ = location;
  }

  /**
   * The text of the token.
   */
  public get text (): string {
    return this.text_;
  }

  /**
   * The type of the token.
   */
  public get tokenType (): TokenType {
    return this.tokenType_;
  }

  /**
   * The location of the token within the source string.
   */
  public get location (): SourceLocation {
    return this.location_;
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
  var tokens: CommandToken[] = [];

  var state = State.Initial;
  var tokenType: TokenType = TokenType.Invalid;
  var tokenStart: number = 0;
  var tokenEnd: number = 0;

  var reset = (): void => {
    tokenType = TokenType.Invalid;
    tokenStart = 0;
    tokenEnd = 0;
    state = State.Initial;
  };
  var reduce = (): void => {
    var tokenText = text.slice(tokenStart, tokenEnd + 1);
    var sourceLocation = new SourceLocation(tokenStart, 0, tokenStart, tokenEnd, 0, tokenEnd);
    var token = new CommandToken(tokenText, tokenType, sourceLocation);
    tokens.push(token);
    reset();
  };
  for (var offset = 0; offset < text.length; offset++) {
    var c = text[offset];
    function shift(nextState: State) {
      recognize(nextState);
      tokenEnd = offset;
      state = nextState;
    }
    function recognize(nextState: State) {
      if (tokenType === TokenType.Invalid) {
        var newTokenType = TokenType.Word;
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
        throw("Invalid character.");
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
          throw("Character not allowed here.");
        }
        break;
      case State.WordBackslash:
        if (/S/.test(c)) {
          shift(State.Word);
        } else {
          throw("Character not allowed here.");
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
          throw("Character not allowed here.");
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
