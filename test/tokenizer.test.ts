/// <reference path="../typings/test/tsd.d.ts" />

import * as Parser from '../lib/parser';
import { CommandStringSource, CommandToken, TokenType } from '../lib/tokenizer';
import { expect } from 'chai';

function tokenize (text: string): CommandToken[] {
  const source = new CommandStringSource(text);
  return source.tokenize();
}

function validateToken (token: CommandToken, text: string, tokenType: TokenType, start: number, end: number) {
  expect(token.text).to.equals(text);
  expect(token.tokenType).to.equals(tokenType);
  expect(token.location.startOffset.char).to.equals(start);
  expect(token.location.endOffset.char).to.equals(end);
}

function itShouldTokenize(text: string, testFn: (tokens: CommandToken[]) => void) {
  it('should tokenize "' + text + '"', () => {
    const tokens = tokenize(text);
    testFn(tokens);
  });
}

describe('Tokenizer Tests:', () => {
    describe('The tokenizer', () => {
        itShouldTokenize('a', (tokens) => {
            expect(tokens.length).to.equals(1);
            validateToken(tokens[0], 'a', TokenType.Word, 0, 0);
        });
        itShouldTokenize(' a ', (tokens) => {
            expect(tokens.length).to.equals(3);
            validateToken(tokens[0], ' ', TokenType.Whitespace, 0, 0);
            validateToken(tokens[1], 'a', TokenType.Word, 1, 1);
            validateToken(tokens[2], ' ', TokenType.Whitespace, 2, 2);
        });
        itShouldTokenize('a b c', (tokens) => {
            expect(tokens.length).to.equals(5);
            validateToken(tokens[0], 'a', TokenType.Word, 0, 0);
            validateToken(tokens[1], ' ', TokenType.Whitespace, 1, 1);
            validateToken(tokens[2], 'b', TokenType.Word, 2, 2);
            validateToken(tokens[3], ' ', TokenType.Whitespace, 3, 3);
            validateToken(tokens[4], 'c', TokenType.Word, 4, 4);
        });
        itShouldTokenize(' aa bb  ccc ', (tokens) => {
            expect(tokens.length).to.equals(7);
            validateToken(tokens[0], ' ', TokenType.Whitespace, 0, 0);
            validateToken(tokens[1], 'aa', TokenType.Word, 1, 2);
            validateToken(tokens[2], ' ', TokenType.Whitespace, 3, 3);
            validateToken(tokens[3], 'bb', TokenType.Word, 4, 5);
            validateToken(tokens[4], '  ', TokenType.Whitespace, 6, 7);
            validateToken(tokens[5], 'ccc', TokenType.Word, 8, 10);
            validateToken(tokens[6], ' ', TokenType.Whitespace, 11, 11);
        });
        itShouldTokenize(' "a" ', (tokens) => {
            expect(tokens.length).to.equals(3);
            validateToken(tokens[0], ' ', TokenType.Whitespace, 0, 0);
            validateToken(tokens[1], '"a"', TokenType.Word, 1, 3);
            validateToken(tokens[2], ' ', TokenType.Whitespace, 4, 4);
        });
        itShouldTokenize(' "a b" ', (tokens) => {
            expect(tokens.length).to.equals(3);
            validateToken(tokens[0], ' ', TokenType.Whitespace, 0, 0);
            validateToken(tokens[1], '"a b"', TokenType.Word, 1, 5);
            validateToken(tokens[2], ' ', TokenType.Whitespace, 6, 6);
        });
        itShouldTokenize(' "a\\\"" ', (tokens) => {
            expect(tokens.length).to.equals(3);
            validateToken(tokens[0], ' ', TokenType.Whitespace, 0, 0);
            validateToken(tokens[1], '"a\\\""', TokenType.Word, 1, 5);
            validateToken(tokens[2], ' ', TokenType.Whitespace, 6, 6);
        });
    });

    describe('The CommandParser', () => {
        it('should consume tokenizer output', () => {
            let handlerRan = false;
            const showInterface = (parser: Parser.CommandParser): void => {
                handlerRan = true;
            };
            const r = new Parser.RootNode();
            const s = new Parser.SymbolNode('show');
            s.addSuccessor(new Parser.CommandNode('interface', showInterface));
            r.addSuccessor(s);
            const p = new Parser.CommandParser(r);
            const tokens = new CommandStringSource('show interface').tokenize();
            p.parse(tokens);
            p.execute();
            expect(handlerRan).to.be.true;
        });
    });
});

