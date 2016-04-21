/// <reference path="../typings/test/tsd.d.ts" />

import Parser = require('../lib/parser');
import Tokenizer = require('../lib/tokenizer');
import chai = require('chai');
var expect = chai.expect;

var makeToken = (text: string): Tokenizer.CommandToken => {
  var type = Tokenizer.TokenType.Word;
  var location = new Tokenizer.SourceLocation(null, 0, 0, 0, 0, 0, 0);
  return new Tokenizer.CommandToken(text, type, location);
};

function nullCommandHandler (): void {
  // Nothing
}

describe('Parser Tests:', () => {

  describe('longestCommonPrefix', () => {
    var longestCommonPrefix = Parser.longestCommonPrefix;
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
      var node = new Parser.ParserNode();
      expect(node.successors.length).to.equals(0);
      var succ = new Parser.ParserNode();
      node.addSuccessor(succ);
      expect(node.successors.length).to.equals(1);
      expect(node.successors[0]).to.equals(succ);
      expect(succ.successors.length).to.equals(0);
    });
  });

  describe('SymbolNode', () => {
    it('can be matched against', () => {
      var node = new Parser.SymbolNode('help');
      var parser = new Parser.CommandParser(node);
      expect(node.match(parser, makeToken('he'))).to.be.true;
      expect(node.match(parser, makeToken('help'))).to.be.true;
      expect(node.match(parser, makeToken('helpe'))).to.be.false;
      expect(node.match(parser, makeToken('ijk'))).to.be.false;
    });
  });

  describe('Parameter', () => {
    it('includes the command as a successor', () => {
      var command = new Parser.Command('test', nullCommandHandler);
      var parameterP = new Parser.Parameter(command, 'p');
      var parameterQ = new Parser.Parameter(command, 'q');
      var node = new Parser.ParserNode();
      parameterP.addSuccessor(node);
      expect(command.successors).to.deep.equal([parameterP, parameterQ]);
      expect(parameterP.successors).to.deep.equal([parameterP, parameterQ, node]);
      expect(parameterQ.successors).to.deep.equal([parameterP, parameterQ]);
    });
  });

  describe('WrapperNode', () => {
    it('has no successors by default', () => {
      var node = new Parser.ParserNode();
      var wrapper = new Parser.WrapperNode('help', node);
      expect(wrapper.successors.length).to.equals(0);
    });
    it('mirrors the successors of the wrapped node', () => {
      var node = new Parser.ParserNode();
      var succ = new Parser.ParserNode();
      node.addSuccessor(succ);
      var wrapper = new Parser.WrapperNode('help', node);
      expect(wrapper.successors.length).to.equals(1);
      expect(wrapper.successors[0]).to.equals(succ);
    });
  });

  describe('The CommandParser', () => {
    it('errors when executing with no commands', () => {
      var n = new Parser.ParserNode();
      var p = new Parser.CommandParser(n);
      expect(p.execute.bind(p)).to.throw('No command.');
    });
    it('is not valid when no command accepted', () => {
      var n = new Parser.ParserNode();
      var p = new Parser.CommandParser(n);
      let errors: Array<string> = [];
      expect(p.verify(errors)).to.be.false;
      expect(errors).to.deep.equal(['Incomplete command.']);
    });
    it('can advance to a command', () => {
      var handlerRan = false;
      var showInterface = (parser: Parser.CommandParser): void => {
        handlerRan = true;
      };
      var r = new Parser.RootNode();
      var s = new Parser.SymbolNode('show');
      s.addSuccessor(new Parser.Command('interface', showInterface));
      r.addSuccessor(s);
      var p = new Parser.CommandParser(r);
      p.advance(makeToken('show'));
      p.advance(makeToken('interface'));
      let errors: Array<string> = [];
      expect(p.verify(errors)).to.be.true;
      expect(errors).to.deep.equal([]);
      p.execute();
      expect(handlerRan).to.be.true;
    });
    it('can handle an unset parameter name', () => {
      var n = new Parser.ParserNode();
      var p = new Parser.CommandParser(n);
      expect(p.getParameter('none')).to.be.undefined;
      expect(p.getParameter('none', true)).to.be.true;
    });
    it('can remember parameter values', () => {
      var n = new Parser.ParserNode();
      var c = new Parser.Command('test', nullCommandHandler);
      var p = new Parser.CommandParser(n);
      var paramA = new Parser.Parameter(c, 'a');
      p.pushParameter(paramA, 'A');
      expect(p.getParameter('a')).to.equals('A');
      var paramB = new Parser.Parameter(c, 'b');
      p.pushParameter(paramB, 'B');
      expect(p.getParameter('a')).to.equals('A');
      expect(p.getParameter('b')).to.equals('B');
    });
    it('can handle repeatable parameters', () => {
      var n = new Parser.ParserNode();
      var c = new Parser.Command('test', nullCommandHandler);
      var p = new Parser.CommandParser(n);
      var paramA = new Parser.Parameter(c, 'a', { repeatable: true });
      p.pushParameter(paramA, 'A');
      expect(p.getParameter('a')).to.deep.equal(['A']);
      p.pushParameter(paramA, 'B');
      expect(p.getParameter('a')).to.deep.equal(['A', 'B']);
    });
  });

});

