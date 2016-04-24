/// <reference path="../typings/test/tsd.d.ts" />

import * as Parser from '../lib/parser';
import * as Tokenizer from '../lib/tokenizer';
import { expect } from 'chai';

const makeToken = (text: string): Tokenizer.CommandToken => {
  const type = Tokenizer.TokenType.Word;
  const location = new Tokenizer.SourceLocation(null, 0, 0, 0, 0, 0, 0);
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
      const node = new Parser.ParserNode();
      expect(node.successors.length).to.equal(0);
      const succ = new Parser.ParserNode();
      node.addSuccessor(succ);
      expect(node.successors.length).to.equal(1);
      expect(node.successors[0]).to.equal(succ);
      expect(succ.successors.length).to.equal(0);
    });
  });

  describe('SymbolNode', () => {
    it('can be matched against', () => {
      const node = new Parser.SymbolNode('help');
      const src = new Tokenizer.CommandStringSource('');
      const parser = new Parser.CommandParser(src, node);
      expect(node.match(parser, makeToken('he'))).to.be.true;
      expect(node.match(parser, makeToken('help'))).to.be.true;
      expect(node.match(parser, makeToken('helpe'))).to.be.false;
      expect(node.match(parser, makeToken('ijk'))).to.be.false;
    });
  });

  describe('Parameter', () => {
    it('includes the command as a successor', () => {
      const command = new Parser.CommandNode('test', nullCommandHandler);
      const parameterP = new Parser.ParameterNode(command, 'p');
      const parameterQ = new Parser.ParameterNode(command, 'q');
      const node = new Parser.ParserNode();
      parameterP.addSuccessor(node);
      expect(command.successors).to.deep.equal([parameterP, parameterQ]);
      expect(parameterP.successors).to.deep.equal([parameterP, parameterQ, node]);
      expect(parameterQ.successors).to.deep.equal([parameterP, parameterQ]);
    });
  });

  describe('WrapperNode', () => {
    it('has no successors by default', () => {
      const node = new Parser.ParserNode();
      const wrapper = new Parser.WrapperNode('help', node);
      expect(wrapper.successors.length).to.equal(0);
    });
    it('mirrors the successors of the wrapped node', () => {
      const node = new Parser.ParserNode();
      const succ = new Parser.ParserNode();
      node.addSuccessor(succ);
      const wrapper = new Parser.WrapperNode('help', node);
      expect(wrapper.successors.length).to.equal(1);
      expect(wrapper.successors[0]).to.equal(succ);
    });
  });

  describe('The CommandParser', () => {
    it('errors when executing with no commands', () => {
      const n = new Parser.ParserNode();
      const s = new Tokenizer.CommandStringSource('');
      const p = new Parser.CommandParser(s, n);
      expect(p.execute.bind(p)).to.throw('No command.');
    });
    it('is not valid when no command accepted', () => {
      const n = new Parser.ParserNode();
      const s = new Tokenizer.CommandStringSource('');
      const p = new Parser.CommandParser(s, n);
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
      const s = new Parser.SymbolNode('show');
      s.addSuccessor(new Parser.CommandNode('interface', showInterface));
      r.addSuccessor(s);
      const src = new Tokenizer.CommandStringSource('show interface');
      const p = new Parser.CommandParser(src, r);
      const ts = src.tokenize();
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
      const n = new Parser.ParserNode();
      const s = new Tokenizer.CommandStringSource('');
      const p = new Parser.CommandParser(s, n);
      expect(p.getParameter('none')).to.be.undefined;
      expect(p.getParameter('none', true)).to.be.true;
    });
    it('can remember parameter values', () => {
      const n = new Parser.ParserNode();
      const c = new Parser.CommandNode('test', nullCommandHandler);
      const s = new Tokenizer.CommandStringSource('');
      const p = new Parser.CommandParser(s, n);
      const paramA = new Parser.ParameterNode(c, 'a');
      p.pushParameter(paramA, 'A');
      expect(p.getParameter('a')).to.equal('A');
      const paramB = new Parser.ParameterNode(c, 'b');
      p.pushParameter(paramB, 'B');
      expect(p.getParameter('a')).to.equal('A');
      expect(p.getParameter('b')).to.equal('B');
    });
    it('can handle repeatable parameters', () => {
      const n = new Parser.ParserNode();
      const c = new Parser.CommandNode('test', nullCommandHandler);
      const s = new Tokenizer.CommandStringSource('');
      const p = new Parser.CommandParser(s, n);
      const paramA = new Parser.ParameterNode(c, 'a', { repeatable: true });
      p.pushParameter(paramA, 'A');
      expect(p.getParameter('a')).to.deep.equal(['A']);
      p.pushParameter(paramA, 'B');
      expect(p.getParameter('a')).to.deep.equal(['A', 'B']);
    });
  });

});

