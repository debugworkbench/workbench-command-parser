import {
    CommandNode, CommandNodeConfig, ParameterKind, ParameterNameNode,
    ParameterNameNodeConfig, ParameterNode, ParameterNodeConfig,
    ParserNode, RootNode, SymbolNode
  } from './parser';
import { FlagNode, StringParameterNode } from './nodes';
import { tokenize, TokenType } from './tokenizer';

export function buildCommand (root: RootNode, config: CommandNodeConfig): CommandNode {
  function findOrMakeSuccessor (node: ParserNode, name: string, maker: () => ParserNode): ParserNode {
    let found: ParserNode = undefined;
    for (const s of node.successors) {
      if (s instanceof SymbolNode && s.symbol === name) {
        found = s;
        break;
      }
    }
    if (found === undefined) {
      found = maker();
      node.addSuccessor(found);
    }
    return found;
  }
  const names = tokenize(config.name).filter((token) => token.tokenType === TokenType.Word).map((token) => token.text);
  let c: CommandNode;
  let cur = root;
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (i === (names.length - 1)) {
      const commandConfig = Object.assign(config, {
        'name': name,
      });
      cur = findOrMakeSuccessor(cur, name, () => new CommandNode(commandConfig));
      c = cur as CommandNode;
    } else {
      const config = {
        'name': name
      };
      cur = findOrMakeSuccessor(cur, name, () => new SymbolNode(config));
    }
  }
  if (config.parameters) {
    for (const p of config.parameters) {
      if (p.kind === 'flag') {
        buildFlagParameter(c, p);
      } else if (p.kind === 'simple') {
        buildSimpleParameter(c, p);
      } else if (p.kind === 'named') {
        buildNamedParameter(c, p);
      }
    }
  }
  return c;
}

function buildFlagParameter (command: CommandNode, config: ParameterNodeConfig): ParameterNode {
  const nodeConstructor = config.nodeConstructor || FlagNode;
  config.command = command;
  config.kind = 'flag';
  const p = new nodeConstructor(config);
  command.addSuccessor(p);
  command.addParameter(p);
  return p;
}

function buildSimpleParameter (command: CommandNode, config: ParameterNodeConfig): ParameterNode {
  const nodeConstructor = config.nodeConstructor || StringParameterNode;
  config.command = command;
  config.kind = 'simple';
  const p = new nodeConstructor(config);
  command.addSuccessor(p);
  command.addParameter(p);
  return p;
}

function buildNamedParameter (command: CommandNode, config: ParameterNodeConfig): ParameterNode {
  const nodeConstructor = config.nodeConstructor || StringParameterNode;
  config.command = command;
  config.kind = 'named';
  const p = new nodeConstructor(config);
  const n = new ParameterNameNode({
    'name': config.name,
    'parameter': p,
    'repeatable': config.repeatable,
    'repeatMarker': p
  });
  n.addSuccessor(p);
  command.addSuccessor(n);
  if (config.aliases) {
    for (const alias of config.aliases) {
      const a = new ParameterNameNode({
        'name': alias,
        'parameter': p,
        'repeatable': config.repeatable,
        'repeatMarker': p
      });
      a.addSuccessor(p);
      command.addSuccessor(a);
    }
  }
  command.addParameter(p);
  return p;
}
