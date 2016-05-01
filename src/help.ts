import { CommandNode, CommandParser,
    ParameterNameNode, ParameterNode,
    RootNode, WrapperNode, WrapperNodeConfig } from './parser';
import { buildCommand } from './builder';

export interface CommandHelp {
  title: string;
  help: string;
  subcommands: Array<{symbol: string, help: string}>;
  parameters: Array<{symbol: string, help: string}>;
}

export function addHelpCommand (root: RootNode, renderer: (help: CommandHelp) => void): void {
  buildCommand(root, <WrapperNodeConfig>{
    name: 'help',
    handler: (parser: CommandParser) => {
      let help = buildCommandHelp(parser);
      renderer(help);
    },
    nodeConstructor: WrapperNode,
    wrappedRoot: root
  });
}

function buildCommandHelp (parser: CommandParser): CommandHelp {
  let cmd: CommandNode = undefined;
  let cmdTitle: Array<string> = [];
  let cmdHelp = "No help.";

  // We skip the first element because we want to skip the "help" command.
  const nodes = parser.nodes.slice(1);

  // find the last command node
  for (const node of nodes) {
    if (node instanceof CommandNode) {
      cmd = node;
      cmdTitle.push(node.symbol);
      if (node.helpText()) {
        cmdHelp = node.helpText();
      }
    }
  }

  // complain if no command found
  if (!cmd) {
    throw(new Error("Incomplete command."));
  }

  // determine possible successor nodes
  const successors = cmd.successors;
  const commands = successors.filter((s) => s instanceof CommandNode);
  const params = successors.filter((s) => s instanceof ParameterNode || s instanceof ParameterNameNode);

  return {
    title: cmdTitle.join(' '),
    help: cmdHelp,
    subcommands: commands.map((c) => ({symbol: c.helpSymbol(), help: c.helpText()})),
    parameters: params.map((p) => ({symbol: p.helpSymbol(), help: p.helpText()}))
  };
}
