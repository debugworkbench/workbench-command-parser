import { buildCommand } from '../../lib/builder';
import * as Parser from '../../lib/parser';
import * as Tokenizer from '../../lib/tokenizer';
import { expect } from 'chai';

const makeToken = (text: string): Tokenizer.CommandToken => {
  const type = Tokenizer.TokenType.Word;
  const location = new Tokenizer.SourceLocation(0, 0, 0, 0, 0, 0);
  return new Tokenizer.CommandToken(text, type, location);
};

function nullCommandHandler (): void {
  // Nothing
}

describe('Parser Tests:', () => {

  describe('longestCommonPrefix', () => {
    const longestCommonPrefix = Parser.longestCommonPrefix;
    it('handles empty options', () => {
      expect(longestCommonPrefix([])).to.equal('');
    });
    it('handles no common prefixes', () => {
      expect(longestCommonPrefix(['a', 'b', 'c'])).to.equal('');
    });
    it('handles having a common prefix', () => {
      expect(longestCommonPrefix(['aa', 'ab', 'ac'])).to.equal('a');
      expect(longestCommonPrefix(['aba', 'abb', 'abc'])).to.equal('ab');
    });
    it('handles the common prefix being the shortest string', () => {
      expect(longestCommonPrefix(['aba', 'ab', 'abc'])).to.equal('ab');
    });
  });

  describe('ParserNode', () => {
    it('manages successors', () => {
      const node = new Parser.SymbolNode({'name': 'show'});
      expect(node.successors.length).to.equal(0);
      const succ = new Parser.SymbolNode({'name': 'interface'});
      node.addSuccessor(succ);
      expect(node.successors.length).to.equal(1);
      expect(node.successors[0]).to.equal(succ);
      expect(succ.successors.length).to.equal(0);
    });
    it('can match a hidden node', () => {
      const root = new Parser.RootNode();
      const node = new Parser.SymbolNode({
        'hidden': true,
        'name': 'help'
      });
      root.addSuccessor(node);
      const parser = new Parser.CommandParser('', root);
      expect(node.match(parser, makeToken('help'))).to.be.true;
    });
  });

  describe('SymbolNode', () => {
    it('can be matched against', () => {
      const root = new Parser.RootNode();
      const node = new Parser.SymbolNode({'name': 'help'});
      root.addSuccessor(node);
      const parser = new Parser.CommandParser('', root);
      expect(node.match(parser, makeToken('he'))).to.be.true;
      expect(node.match(parser, makeToken('help'))).to.be.true;
      expect(node.match(parser, makeToken('helpe'))).to.be.false;
      expect(node.match(parser, makeToken('ijk'))).to.be.false;
    });
  });

  describe('Parameter', () => {
    it('includes the command as a successor', () => {
      const r = new Parser.RootNode();
      const command = buildCommand(r, {
        'name': 'test',
        'handler': nullCommandHandler,
        'parameters': [
          {
            'name': 'p',
            'kind': 'simple'
          },
          {
            'name': 'q',
            'kind': 'simple'
          }
        ]
      });
      const parameterP = command.getParameterNode('p');
      const parameterQ = command.getParameterNode('q');
      expect(command.successors).to.deep.equal([parameterP, parameterQ]);
      expect(parameterP.successors).to.deep.equal([parameterP, parameterQ]);
      expect(parameterQ.successors).to.deep.equal([parameterP, parameterQ]);
    });
  });

  describe('WrapperNode', () => {
    it('has no successors by default', () => {
      const node = new Parser.CommandNode({
        'name': 'show',
        'handler': null
      });
      const wrapper = new Parser.WrapperNode({
        'name': 'help',
        'handler': null,
        'wrappedRoot': node
      });
      expect(wrapper.successors.length).to.equal(0);
    });
    it('mirrors the successors of the wrapped node', () => {
      const node = new Parser.SymbolNode({'name': 'show'});
      const succ = new Parser.CommandNode({
        'name': 'interface',
        'handler': null
      });
      node.addSuccessor(succ);
      const wrapper = new Parser.WrapperNode({
        'name': 'help',
        'handler': null,
        'wrappedRoot': node
      });
      expect(wrapper.successors.length).to.equal(1);
      expect(wrapper.successors[0]).to.equal(succ);
    });
  });

  describe('The CommandParser', () => {
    it('errors when executing with no commands', () => {
      const r = new Parser.RootNode();
      const p = new Parser.CommandParser('', r);
      expect(p.execute.bind(p)).to.throw('No command.');
    });
    it('is not valid when no command accepted', () => {
      const r = new Parser.RootNode();
      const p = new Parser.CommandParser('', r);
      let errors: Array<string> = [];
      expect(p.verify(errors)).to.be.false;
      expect(errors).to.deep.equal(['Incomplete command.']);
    });
    it('can advance to a command', () => {
      let handlerRan = false;
      const showInterface = (parser: Parser.CommandParser): void => {
        handlerRan = true;
      };
      const r = new Parser.RootNode();
      buildCommand(r, {
        'name': 'show interface',
        'handler': showInterface
      });
      const commandText = 'show interface';
      const p = new Parser.CommandParser(commandText, r);
      const ts = Tokenizer.tokenize(commandText);
      for (let t of ts) {
        if (t.tokenType === Tokenizer.TokenType.Word) {
          p.advance(t);
        }
      }
      let errors: Array<string> = [];
      expect(p.verify(errors)).to.be.true;
      expect(errors).to.deep.equal([]);
      p.execute();
      expect(handlerRan).to.be.true;
    });
    it('can handle an unset parameter name', () => {
      const r = new Parser.RootNode();
      const p = new Parser.CommandParser('', r);
      expect(p.getParameter('none')).to.be.undefined;
      expect(p.getParameter('none', true)).to.be.true;
    });
    it('can remember parameter values', () => {
      const r = new Parser.RootNode();
      const c = buildCommand(r, {
        'name': 'show',
        'handler': nullCommandHandler,
        'parameters': [
          {
            'name': 'a',
            'kind': 'named'
          },
          {
            'name': 'b',
            'kind': 'named'
          }
        ]
      });
      const p = new Parser.CommandParser('', r);
      const paramA = c.getParameterNode('a');
      const paramB = c.getParameterNode('b');
      p.advance(makeToken('show'));
      p.advance(makeToken('a'));
      p.advance(makeToken('A'));
      expect(p.getParameter('a')).to.equal('A');
      p.advance(makeToken('b'));
      p.advance(makeToken('B'));
      expect(p.getParameter('a')).to.equal('A');
      expect(p.getParameter('b')).to.equal('B');
    });
    it('can handle repeatable parameters', () => {
      const r = new Parser.RootNode();
      const c = buildCommand(r, {
        'name': 'test',
        'handler': nullCommandHandler,
        'parameters': [
          {
            'name': 'a',
            'kind': 'simple',
            'repeatable': true
          }
        ]
      });
      const p = new Parser.CommandParser('', r);
      const paramA = c.getParameterNode('a');
      p.advance(makeToken('test'));
      p.advance(makeToken('A'));
      expect(p.getParameter('a')).to.deep.equal(['A']);
      p.advance(makeToken('B'));
      expect(p.getParameter('a')).to.deep.equal(['A', 'B']);
    });
  });

  describe('Completion', () => {
    it('does not consider hidden nodes', () => {
      const root = new Parser.RootNode();
      const node = new Parser.SymbolNode({
        'hidden': true,
        'name': 'help'
      });
      root.addSuccessor(node);
      const parser = new Parser.CommandParser('', root);
      expect(parser.complete(makeToken('help'))).to.be.empty;
    });
    it('handles no valid completeions', () => {
      const root = new Parser.RootNode();
      const parser = new Parser.CommandParser('', root);
      expect(parser.complete()).to.be.empty;
    });
  });

});

