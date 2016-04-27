import { tokenize, CommandToken, TokenType } from './tokenizer';

export class CommandParser {
  private source: string;
  private initialNode: RootNode;
  private currentNode: ParserNode;
  private nodes: ParserNode[] = [];
  private tokens: CommandToken[] = [];
  private commands: CommandNode[] = [];
  private parameters: Map<string, any> = new Map();

  constructor (source: string, initialNode: RootNode) {
    this.source = source;
    this.initialNode = initialNode;
    this.currentNode = this.initialNode;
  }

  /**
   * Called when a [[CommandNode]] has been accepted.
   *
   * @private
   */
  pushCommand (command: CommandNode): void {
    this.commands.push(command);
  }

  /**
   * @private
   */
  nodeSeen (node: ParserNode): boolean {
    return this.nodes.indexOf(node) >= 0;
  }

  /**
   * @private
   */
  pushNode (token: CommandToken, node: ParserNode): void {
    this.currentNode = node;
    this.nodes.push(node);
    this.tokens.push(token);
  }

  getParameter (name: string, defaultValue?: any): any {
    return this.parameters.get(name) || defaultValue;
  }

  /**
   * Called when a [[ParameterNode]] has been accepted.
   *
   * @private
   */
  pushParameter (param: ParameterNode, value: any): any {
    if (param.repeatable) {
      var list = this.parameters.get(param.name) || [];
      list.push(value);
      this.parameters.set(param.name, list);
    } else {
      this.parameters.set(param.name, value);
    }
    return value;
  }

  /**
   * Perform completion on the current parser state.
   */
  complete (token?: CommandToken): Completion[] {
    var completions = this.currentNode.possibleCompletions(this, token);
    var completionForNode = (node: ParserNode): Completion => {
      return node.complete(this, token);
    };
    return completions.map(completionForNode);
  }

  /**
   * Parse the given token sequence.
   *
   * Iterates over tokens and performs our regular phrase parse.
   */
  parse (tokens: CommandToken[]): void {
    tokens.forEach(token => {
      if (token.tokenType !== TokenType.Whitespace) {
        this.advance(token);
      }
    });
  }

  /**
   * Advance the parser by one step.
   */
  advance (token: CommandToken): void {
    var possibleMatches = this.currentNode.matchingSuccessors(this, token);
    // Deal with command priorities.
    if (possibleMatches.length === 1) {
      var matchingNode = possibleMatches[0];
      matchingNode.accept(this, token);
      this.pushNode(token, matchingNode);
    } else if (possibleMatches.length === 0) {
      throw(new Error('At node ' + this.currentNode + ': No matches for "' + token.text + '"'));
    } else {
      throw("Ambiguous match.");
    }
  }

  /**
   * Execute the parsed command.
   *
   * This will call the OUTERMOST handler.
   *
   * XXX: We should expose a next-handler somehow so that we can
   *      have wrapper commands like "with-log $logfile $command".
   */
  execute (): void {
    if (this.commands.length > 0) {
      var command = this.commands[this.commands.length - 1];
      command.execute(this);
    } else {
      throw("No command.");
    }
  }

  /**
   * Verify the parsed command.
   */
  verify (errorAccumulator: Array<string>): boolean {
    if (this.commands.length > 0) {
      const command = this.commands[this.commands.length - 1];
      const expected = command.parameters;
      const provided = this.parameters;
      expected.forEach(parameter => {
        if (parameter.required) {
          if (false === provided.has(parameter.name)) {
            errorAccumulator.push('Missing required parameter "' + parameter.name + '".');
            return false;
          }
        }
      });
    } else {
       errorAccumulator.push('Incomplete command.');
       return false;
    }
    return true;
  }
}

export enum NodePriority {
  Minimum = -10000,
  Parameter = -10,
  Default = 0
}

/**
 * Represents the result of completing a node,
 * possibly hinted by a pre-existing token.
 */
export class Completion {
  /** Node the completion was performed for. */
  node: ParserNode;
  /** Value placeholder for help. */
  helpSymbol: string;
  /** Main help text. */
  helpText: string;
  /** Token used to hint the completion, if provided. */
  token: CommandToken;
  /** Was this completion exhaustive? If yes, then only the
      given completion options are valid. */
  exhaustive: boolean = false;
  /** Actual completion options. */
  options: CompletionOption[];

  constructor (node: ParserNode, token: CommandToken, options: CompletionConfig) {
    this.node = node;
    this.token = token;
    // Get node help strings.
    this.helpSymbol = node.helpSymbol();
    this.helpText = node.helpText();
    if (options.exhaustive === undefined) {
      this.exhaustive = options.exhaustive;
    } else {
      this.exhaustive = false;
    }
    var completeOptions = options.completeOptions || [];
    var otherOptions = options.otherOptions || [];
    // Apply token restrictions.
    if (token) {
      // Filter options using token.
      completeOptions = completeOptions.filter((option): boolean => {
        return option.startsWith(token.text);
      });
      otherOptions = otherOptions.filter((option): boolean => {
        return option.startsWith(token.text);
      });
      if (!this.exhaustive) {
        // If not exhaustive, then add the current token as an incomplete option.
        if ((completeOptions.indexOf(token.text) === -1) &&
            (otherOptions.indexOf(token.text) === -1)) {
          otherOptions.push(token.text);
        }
      }
    }
    // Add longest common prefix as an incomplete option, but
    // filter it against the existing options and the token.
    var allOptions = completeOptions.concat(otherOptions);
    var lcp = longestCommonPrefix(allOptions);
    if (lcp && allOptions.indexOf(lcp) === -1) {
      if (!token || (lcp !== token.text)) {
        otherOptions.push(lcp);
      }
    }
    this.options = completeOptions.map((optionString): CompletionOption => {
      return new CompletionOption(this, optionString, true);
    }).concat(otherOptions.map((optionString): CompletionOption => {
      return new CompletionOption(this, optionString, false);
    }));
  }
}

/**
 * Represents a single option returned by completion.
 *
 * An option may be COMPLETE, which means that it represents
 * a syntactically complete parameter value which can be
 * used as-is, whereas INCOMPLETE options are not valid values.
 */
export class CompletionOption {
  /** Initialized by [[Completion.constructor]]. */
  completion: Completion;
  /** String for this option. */
  optionString: string;
  /** True if this option is COMPLETE. */
  complete: boolean = false;

  constructor (completion: Completion, optionString: string, complete: boolean) {
    this.completion = completion;
    this.optionString = optionString;
    this.complete = complete;
  }
}

export interface CompletionConfig {
  exhaustive: boolean;
  completeOptions?: string[];
  otherOptions?: string[];
}

export function longestCommonPrefix(options: string[]): string {
  if (options.length > 0) {
    for (var i = 0; ; i++) {
      var first = options[0];
      for (var j = 0; j < options.length; j++) {
        var option = options[j];
        if ((i === option.length) || (option[i] !== first[i])) {
          return first.slice(0, i);
        }
      }
    }
  } else {
    return "";
  }
}

/**
 * Grammar node for the CLI
 *
 * These form a digraph with circles through their SUCCESSORS
 * field. Cycles can only occur through nodes that are REPEATABLE,
 * so the graph can be treated like a DAG when repeatable nodes
 * are ignored or visited only once.
 *
 * Each [[ParserNode|node]] represents one [[CommandToken|command token]].
 *
 * Important operations:
 *
 * * Matching allows the parser to check if a given node is
 *   a valid partial or complete word for this node.
 *
 * * Completion allows the parser to generate possible
 *   words for a node. The parser may provide a partial token
 *   to limit and direct completion.
 *
 * * Accepting happens when the parser accepts a token for
 *   a node. During this, parameters add their values and
 *   commands install their handlers.
 */
export abstract class ParserNode {
  /** Possible successor nodes (collected while building). */
  protected successors_: ParserNode[] = [];
  /** Match and completion priority. */
  protected priority_: NodePriority = NodePriority.Default;
  /** Hidden nodes are not completed. */
  protected hidden_: boolean = false;

  public get successors (): ParserNode[] {
    return this.successors_;
  }

  public helpSymbol (): string {
    return "<...>";
  }

  public helpText (): string {
    return "No help.";
  }

  /**
   * @private
   */
  toString (): string {
    return '[ParserNode]';
  }

  /**
   * Generate completions for the given node
   *
   * May or may not be provided a partial token.
   */
  complete (parser: CommandParser, token?: CommandToken): Completion {
    return new Completion(this, token, { exhaustive: true });
  }

  /**
   * Check if the given token matches this node partially or completely
   */
  match (parser: CommandParser, token: CommandToken): boolean {
    return false;
  }

  /**
   * Accept the given node with the given token as data
   *
   * This is where parameters do conversion and command handlers are added.
   */
  accept (parser: CommandParser, token: CommandToken): void {
    // Nothing to do.
  }

  /**
   * Is the node acceptable as next node in given parser state?
   *
   * This prevents non-repeatable parameters from being added again.
   *
   * Note how we also check for the repeat-marker of the node for
   * cases where another node can preclude our occurrence.
   */
  acceptable (parser: CommandParser): boolean {
    return false === parser.nodeSeen(this);
  }

  /**
   * Called by the parser to get possible completions so
   * that the parser needn't have access to the internal
   * state of the node.
   */
  possibleCompletions (parser: CommandParser, token?: CommandToken): ParserNode[] {
    // Filter out hidden nodes, non-acceptable nodes and, if there is a token,
    // filter with that as well.
    return this.successors.filter(node => {
      return !node.hidden_ && node.acceptable(parser) && (!token || node.match(parser, token));
    });
  }

  matchingSuccessors (parser: CommandParser, token: CommandToken): ParserNode[] {
    return this.successors.filter(node => {
      return node.acceptable(parser) && node.match(parser, token);
    });
  }

  addSuccessor (node: ParserNode): void {
    this.successors_.push(node);
  }
}

/**
 * Root of a command hierarchy.
 *
 * May not be completed or matched.
 */
export class RootNode extends ParserNode {
  /**
   * @private
   */
  toString (): string {
    return '[RootNode]';
  }

  complete (parser: CommandParser, token: CommandToken | boolean): Completion {
    throw("BUG: Tried to complete a root node.");
  }

  match (parser: CommandParser, token: CommandToken): boolean {
    throw("BUG: Tried to match a root node.");
  }
}

/**
 * A fixed string.
 *
 * Used to build commands and parameter prefixes.
 */
export abstract class SymbolNode extends ParserNode {
  protected symbol: string;

  constructor (symbol: string) {
    super();
    this.symbol = symbol;
  }

  /**
   * @private
   */
  toString (): string {
    return '[SymbolNode: ' + this.symbol + ']';
  }

  public helpSymbol (): string {
    return this.symbol;
  }

  public helpText (): string {
    return "";
  }

  complete (parser: CommandParser, token?: CommandToken): Completion {
    return new Completion(this, token, {
                            exhaustive: true,
                            completeOptions: [this.symbol]
                          });
  }

  match (parse: CommandParser, token: CommandToken): boolean {
    return this.symbol.startsWith(token.text);
  }
}

/**
 * Commands are symbols with a handler and parameter requirements.
 */
export class CommandNode extends SymbolNode {
  /** Help source for the command. */
  private help: string;
  /** Handler function. */
  private handler: Function;
  /** Parameters (collected while building). */
  private parameters_: ParameterNode[] = [];

  public get parameters (): ParameterNode[] {
    return this.parameters_;
  }

  constructor (name: string, handler: Function) {
    super(name);
    this.handler = handler;
  }

  /**
   * @private
   */
  toString (): string {
    return '[Command: ' + this.symbol + ']';
  }

  accept (parser: CommandParser, token: CommandToken): void {
    if (this.handler) {
      parser.pushCommand(this);
    }
  }

  complete (parser: CommandParser, token?: CommandToken): Completion {
    return new Completion(this, token, {
                            exhaustive: true,
                            completeOptions: [this.symbol]
                          });
  }

  /**
   * @private
   */
  addParameter (parameter: ParameterNode): void {
    this.parameters_.push(parameter);
  }

  /**
   * @private
   */
  execute (parser: CommandParser): void {
    this.handler(parser);
  }
}

/**
 * Wrappers allow wrapping another command
 *
 * This is used for the "help" command so it can complete normal commands.
 *
 * They will have the successors of the given ROOT.
 *
 */
export class WrapperNode extends CommandNode {
  private root: ParserNode;

  constructor (symbol: string, root: ParserNode) {
    super(symbol, undefined);
    this.root = root;
  }

  public get successors (): ParserNode[] {
    return this.root.successors;
  }
}

export class ParameterNameNode extends SymbolNode {
  private parameter: ParameterNode;

  constructor (name: string, parameter: ParameterNode, options: any) {
    super(name);
    this.parameter = parameter;
  }

  public helpSymbol (): string {
    return this.symbol + this.parameter.helpSymbol();
  }

  public helpText (): string {
    return this.parameter.helpText();
  }
}

/**
 * Syntactical kinds of parameters.
 */
export enum ParameterKind {
  Flag,
  Named,
  Simple
}

export interface ParameterOptions {
  aliases?: Array<string>;
  help?: string;
  repeatable?: boolean;
  repeatMarker?: ParserNode;
  required?: boolean;
}

/**
 * A captured parameter.
 */
export class ParameterNode extends SymbolNode {
  private command: CommandNode;
  private parameterKind_: ParameterKind;
  private options: ParameterOptions;

  public get help (): string {
    return this.options.help;
  }

  public get parameterKind (): ParameterKind {
    return this.parameterKind_;
  }

  public get repeatable (): boolean {
    return this.options.repeatable || false;
  }

  public get repeatMarker (): ParserNode {
    return this.options.repeatMarker;
  }

  public get required (): boolean {
    return this.options.required || false;
  }

  constructor (command: CommandNode, name: string, kind: ParameterKind, options?: ParameterOptions) {
    super(name);
    this.command = command;
    this.parameterKind_ = kind;
    this.options = options || {};
  }

  public get name (): string {
    return this.symbol;
  }

  /**
   * Parameters have the successors of their command, in addition to their own.
   *
   * This is what allows having several parameters.
   */
  public get successors (): ParserNode[] {
    if (this.command) {
      return this.command.successors.concat(this.successors_);
    } else {
      return this.successors_;
    }
  }

  public helpSymbol (): string {
    if (this.repeatable) {
      return "<" + this.name + ">...";
    } else {
      return "<" + this.name + ">";
    }
  }

  public helpText (): string {
    return this.help || "Parameter";
  }

  /**
   * Parameters can be converted to values.
   *
   * By default, they convert to simple strings.
   */
  convert (parser: CommandParser, token: CommandToken): any {
    return token.text;
  }

  /**
   * Parameters complete only to themselves.
   */
  complete (parser: CommandParser, token?: CommandToken): Completion {
    return new Completion(this, token, { exhaustive: true });
  }

  /**
   * Parameters get registered as such when accepted.
   */
  accept (parser: CommandParser, token: CommandToken): void {
    parser.pushParameter(this, this.convert(parser, token));
  }

  /**
   * Is the node acceptable as the next node in the given parser state?
   *
   * This prevents non-repeatable parameters from being added again.
   *
   * Note how we also check for the repeatMarker of the node for cases
   * where another node can preclude our occurrence.
   */
  acceptable (parser: CommandParser): boolean {
    if (this.repeatable) {
      return true;
    } else {
      // If we haven't been seen, but we have a repeat marker,
      // and that marker hasn't been seen, then we're acceptable.
      return !parser.nodeSeen(this) &&
             ((this.repeatMarker === undefined) ||
              (!parser.nodeSeen(this.repeatMarker)));
    }
  }
}
