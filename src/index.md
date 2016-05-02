A command parser.

Constructing a Command Tree
---------------------------

The command tree is stored starting from a [[RootNode]]. We keep
this command tree and re-use it with each instance of the
[[CommandParser]] that we create.

Commands are constructed using [[buildCommand]] which takes a
[[CommandNodeConfig]] value, creates the corresponding command
and adds it to the [[RootNode]] passed in.

Basic Usage
-----------

* Construct a [[CommandParser]] with input and a [[RootNode]].
* Tokenize the input.
* Parse the command.
* Verify the parsed command.
* Execute the parsed command.

```
const parser = new CommandParser(input, rootNode);
const tokens = tokenize(input);
parser.parse(tokens);
let errors: Array<string> = [];
if (parser.verify(errors)) {
  parser.execute();
} else {
  // Do something about the errors.
}
```
