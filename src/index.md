A command parser.

Constructing a Command Tree
---------------------------

The command tree is stored starting from a [[RootNode]]. We keep
this command tree and re-use it with each instance of the
[[CommandParser]] that we create.


Basic Usage
-----------

* Construct a [[CommandSource]] with some input.
* Construct a [[CommandParser]] with a [[RootNode]].
* Tokenize the input.
* Parse the command.
* Verify the parsed command.
* Execute the parsed command.

```
const source = new CommandStringSource(input);
const parser = new CommandParser(source, rootNode);
const tokens = source.tokenize();
parser.parse(tokens);
let errors: Array<string> = [];
if (parser.verify(errors)) {
  parser.execute();
} else {
  // Do something about the errors.
}
```
