import { CommandNode, ParameterKind, ParameterNameNode, ParameterNode, ParameterOptions, RootNode } from './parser';
import { FlagNode, StringParameterNode } from './nodes';

export function buildFlagParameter (command: CommandNode, name: string, options?: ParameterOptions): ParameterNode {
  const p = new FlagNode(command, name, ParameterKind.Flag, options);
  command.addSuccessor(p);
  command.addParameter(p);
  return p;
}

export function buildSimpleParameter (command: CommandNode, name: string, options?: ParameterOptions): ParameterNode {
  const p = new StringParameterNode(command, name, ParameterKind.Simple, options);
  command.addSuccessor(p);
  command.addParameter(p);
  return p;
}

export function buildNamedParameter (command: CommandNode, name: string, options?: ParameterOptions): ParameterNode {
  const p = new StringParameterNode(command, name, ParameterKind.Named, options);
  options.repeatMarker = p;
  const n = new ParameterNameNode(name, p, options);
  n.addSuccessor(p);
  command.addSuccessor(n);
  if (options.aliases) {
    for (const alias of options.aliases) {
      const a = new ParameterNameNode(alias, p, options);
      a.addSuccessor(p);
      command.addSuccessor(a);
    }
  }
  command.addParameter(p);
  return p;
}
