import { CommandSource, CommandToken, TokenType } from './tokenizer';

export class CommandParser {
  private source: CommandSource;
  private initialNode: ParserNode;
  private currentNode: ParserNode;
  private nodes: ParserNode[] = [];
  private tokens: CommandToken[] = [];
  private commands: Command[] = [];
  private parameters: Map<string, any> = new Map();

  constructor (initialNode: ParserNode) {
    this.initialNode = initialNode;
    this.currentNode = this.initialNode;
  }

  pushCommand (command: Command): void {
    this.commands.push(command);
  }

  nodeSeen (node: ParserNode): boolean {
    return this.nodes.indexOf(node) >= 0;
  }

  pushNode (token: CommandToken, node: ParserNode): void {
    this.currentNode = node;
    this.nodes.push(node);
    this.tokens.push(token);
  }

  getParameter (name: string, defaultValue?: any): any {
    return this.parameters.get(name) || defaultValue;
  }

  pushParameter (param: Parameter, value: any): any {
    if (param.repeatable) {
      var list = this.parameters.get(param.name) || [];
      list.push(value);
      this.parameters.set(param.name, list);
    } else {
      this.parameters.set(param.name, value);
    }
    return value;
  }

  complete (token?: CommandToken): Completion[] {
    var completions = this.currentNode.possibleCompletions(this, token);
    var completionForNode = (node: ParserNode): Completion => {
      return node.complete(this, token);
    };
    return completions.map(completionForNode);
  }

  parse (tokens: CommandToken[]): void {
    tokens.forEach(token => {
      if (token.tokenType !== TokenType.Whitespace) {
        this.advance(token);
      }
    });
  }

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

  execute (): void {
    if (this.commands.length > 0) {
      var command = this.commands[this.commands.length - 1];
      command.execute(this);
    } else {
      throw("No command.");
    }
  }
}

export enum NodePriority {
  Minimum = -10000,
  Parameter = -10,
  Default = 0
}

export class Completion {
  node: ParserNode;
  helpSymbol: string;
  helpText: string;
  token: CommandToken;
  exhaustive: boolean = false;
  options: CompletionOption[];
}

export class CompletionOption {
  completion: Completion;
  optionString: string;
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

function makeCompletion(node: ParserNode, token: CommandToken, options: CompletionConfig): Completion {
  var completion = new Completion();
  completion.node = node;
  completion.token = token;
  completion.helpSymbol = node.helpSymbol();
  completion.helpText = node.helpText();
  if (options.exhaustive === undefined) {
    completion.exhaustive = options.exhaustive;
  } else {
    completion.exhaustive = false;
  }
  var completeOptions = options.completeOptions || [];
  var otherOptions = options.otherOptions || [];
  if (token) {
    completeOptions = completeOptions.filter((option): boolean => {
      // POLYFILL: No String.startsWith.
      return option.lastIndexOf(token.text) === 0;
    });
    otherOptions = otherOptions.filter((option): boolean => {
      // POLYFILL: No String.startsWith.
      return option.lastIndexOf(token.text) === 0;
    });
    if (!completion.exhaustive) {
      // If not exhaustive, then add the current token as an incomplete option.
      if ((completeOptions.indexOf(token.text) === -1) &&
          (otherOptions.indexOf(token.text) === -1)) {
        otherOptions.push(token.text);
      }
    }
  }
  var allOptions = completeOptions.concat(otherOptions);
  var lcp = longestCommonPrefix(allOptions);
  if (lcp && allOptions.indexOf(lcp) === -1) {
    if (!token || (lcp !== token.text)) {
      otherOptions.push(lcp);
    }
  }
  completion.options = completeOptions.map((optionString): CompletionOption => {
    return new CompletionOption(completion, optionString, true);
  }).concat(otherOptions.map((optionString): CompletionOption => {
    return new CompletionOption(completion, optionString, false);
  }));
  return completion;
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
 * Each node represents one command token.
 *
 * Important operations:
 *
 *  Matching allows the parser to check if a given node is
 *  a valid partial or complete word for this node.
 *
 *  Completion allows the parser to generate possible
 *  words for a node. The parser may provide a partial token
 *  to limit and direct completion.
 *
 *  Accepting happens when the parser accepts a token for
 *  a node. During this, parameters add their values and
 *  commands install their handlers.
 */
export class ParserNode {
  protected successors_: ParserNode[] = [];
  protected priority_: NodePriority = NodePriority.Default;
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

  toString (): string {
    return '[ParserNode]';
  }

  /**
   * Generate completions for the given node
   *
   * May or may not be provided a partial token.
   */
  complete (parser: CommandParser, token?: CommandToken): Completion {
    return makeCompletion(this, token, { exhaustive: true });
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

  possibleCompletions (parser: CommandParser, token?: CommandToken): ParserNode[] {
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
export class SymbolNode extends ParserNode {
  protected symbol: string;

  constructor (symbol: string) {
    super();
    this.symbol = symbol;
  }

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
    return makeCompletion(this, token, {
                            exhaustive: true,
                            completeOptions: [this.symbol]
                          });
  }

  match (parse: CommandParser, token: CommandToken): boolean {
    // POLYFILL: No String.startsWith.
    return this.symbol.lastIndexOf(token.text) === 0;
  }
}

/**
 * Commands are symbols with a handler and parameter requirements.
 */
export class Command extends SymbolNode {
  private help: string;
  private handler: Function;
  private parameters: Parameter[] = [];
  private flagParameters: Parameter[] = [];
  private namedParameters: Parameter[] = [];
  private simpleParameters: Parameter[] = [];

  constructor (name: string, handler: Function) {
    super(name);
    this.handler = handler;
  }

  toString (): string {
    return '[Command: ' + this.symbol + ']';
  }

  accept (parser: CommandParser, token: CommandToken): void {
    if (this.handler) {
      parser.pushCommand(this);
    }
  }

  complete (parser: CommandParser, token?: CommandToken): Completion {
    return makeCompletion(this, token, {
                            exhaustive: true,
                            completeOptions: [this.symbol]
                          });
  }

  addParameter (parameter: Parameter): void {
    this.parameters.push(parameter);
    if (parameter.parameterKind === ParameterKind.Flag) {
      this.flagParameters.push(parameter);
    } else if (parameter.parameterKind === ParameterKind.Named) {
      this.namedParameters.push(parameter);
    } else if (parameter.parameterKind === ParameterKind.Simple) {
      this.simpleParameters.push(parameter);
    }
  }

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
export class WrapperNode extends Command {
  private root: ParserNode;

  constructor (symbol: string, root: ParserNode) {
    super(symbol, undefined);
    this.root = root;
  }

  public get successors (): ParserNode[] {
    return this.root.successors;
  }
}

export enum ParameterKind {
  Flag,
  Named,
  Simple
}

export interface ParameterOptions {
  parameterKind?: ParameterKind;
  help?: string;
  repeatable?: boolean;
}

export class Parameter extends SymbolNode {
  private parameterKind_: ParameterKind = ParameterKind.Simple;
  private help: string;
  private command: Command;
  private repeatable_: boolean = false;
  private repeatMarker_: ParserNode;

  public get parameterKind (): ParameterKind {
    return this.parameterKind_;
  }

  public get repeatable (): boolean {
    return this.repeatable_;
  }

  constructor (command: Command, name: string, options?: ParameterOptions) {
    super(name);
    this.command = command;
    if (options) {
      if (options.parameterKind !== undefined) {
        this.parameterKind_ = options.parameterKind;
      }
      if (options.repeatable !== undefined) {
        this.repeatable_ = options.repeatable;
      }
      this.help = options.help;
    }
    this.command.addSuccessor(this);
    this.command.addParameter(this);
  }

  public get name (): string {
    return this.symbol;
  }

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

  convert (parser: CommandParser, token: CommandToken): any {
    return token.text;
  }

  complete (parser: CommandParser, token?: CommandToken): Completion {
    return makeCompletion(this, token, { exhaustive: true });
  }

  accept (parser: CommandParser, token: CommandToken): void {
    parser.pushParameter(this, this.convert(parser, token));
  }

  acceptable (parser: CommandParser): boolean {
    if (this.repeatable) {
      return true;
    } else {
      // If we haven't been seen, but we have a repeat marker,
      // and that marker hasn't been seen, then we're acceptable.
      return !parser.nodeSeen(this) &&
             ((this.repeatMarker_ === undefined) ||
              (!parser.nodeSeen(this.repeatMarker_)));
    }
  }
}
