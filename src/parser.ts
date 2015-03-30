import tokenizer = require('./tokenizer');

import CommandSource = tokenizer.CommandSource;
import CommandToken = tokenizer.CommandToken;
import TokenType = tokenizer.TokenType;

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

  parse (tokens: CommandToken[]): void {
    tokens.forEach(token => {
      if (token.type !== TokenType.Whitespace) {
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

export class CommandCompletion {
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
  protected repeatable_: boolean = false;
  protected repeatMarker_: ParserNode | boolean = false;

  public get repeatable (): boolean {
    return this.repeatable_;
  }

  public get successors (): ParserNode[] {
    return this.successors_;
  }

  toString (): string {
    return '[ParserNode]';
  }

  /**
   * Generate completions for the given node
   *
   * May or may not be provided a partial token.
   */
  complete (parser: CommandParser, token: CommandToken | boolean): CommandCompletion[] {
    return [];
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
    if (this.repeatable) {
      return true;
    } else {
      /*
      ~member?(node, parser-nodes(parser))
        & (node-repeat-marker(node) == #f
             | ~member?(node-repeat-marker(node), parser-nodes(parser)));
      */
      return true;
    }
  }

  matchingSuccessors(parser: CommandParser, token: CommandToken): ParserNode[] {
    return this.successors.filter(node => {
      return node.acceptable(parser) && node.match(parser, token);
    });
  }

  addSuccessor (node: ParserNode): void {
    this.successors_.push(node);
  }
}

export class RootNode extends ParserNode {
  toString (): string {
    return '[RootNode]';
  }

  complete (parser: CommandParser, token: CommandToken | boolean): CommandCompletion[] {
    throw("BUG: Tried to complete a root node.");
  }

  match (parser: CommandParser, token: CommandToken): boolean {
    throw("BUG: Tried to match a root node.");
  }
}

export class SymbolNode extends ParserNode {
  protected symbol: string;

  constructor (symbol: string) {
    super();
    this.symbol = symbol;
  }

  toString (): string {
    return '[SymbolNode: ' + this.symbol + ']';
  }

  match (parse: CommandParser, token: CommandToken): boolean {
    // POLYFILL: No String.startsWith.
    return this.symbol.lastIndexOf(token.text) === 0;
  }
}

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

export interface ParameterOptions {
  repeatable: boolean;
}

export class Parameter extends SymbolNode {
  private command: Command;

  constructor (command: Command, name: string, options?: ParameterOptions) {
    super(name);
    this.command = command;
    this.command.addSuccessor(this);
    if (options) {
      if (options.repeatable !== undefined) {
        this.repeatable_ = options.repeatable;
      }
    }
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

  convert (parser: CommandParser, token: CommandToken): any {
    return token.text;
  }

  accept (parser: CommandParser, token: CommandToken): void {
    parser.pushParameter(this, this.convert(parser, token));
  }
}
