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

describe('Parser Tests:', () => {

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

  describe('CommandParser', () => {
    it('errors when executing with no commands', () => {
      var n = new Parser.ParserNode();
      var p = new Parser.CommandParser(n);
      expect(p.execute.bind(p)).to.throw('No command.');
    });
    it('can advance to a command', () => {
      var handlerRan = false;
      var showInterface = (parser: Parser.CommandParser): void => {
        handlerRan = true;
      };
      var r = new Parser.RootNode();
      var s = new Parser.SymbolNode('show');
      s.addSuccessor(new Parser.CommandNode('interface', showInterface));
      r.addSuccessor(s);
      var p = new Parser.CommandParser(r);
      p.advance(makeToken('show'));
      p.advance(makeToken('interface'));
      p.execute();
      expect(handlerRan).to.be.true;
    });
  });

});

