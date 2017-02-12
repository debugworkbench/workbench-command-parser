import { buildCommand } from '../../lib/builder';
import * as Parser from '../../lib/parser';
import { addHelpCommand, CommandHelp } from '../../lib/help';
import { makeToken, nullCommandHandler } from './parser.test';
import { expect } from 'chai';

describe('Auto-generated help tests:', () => {
    const root = new Parser.RootNode();
    buildCommand(root, {
        name: 'show',
        help: 'Show stuff',
        handler: nullCommandHandler
    });
    buildCommand(root, {
        name: 'show interface',
        help: 'Show an interface',
        handler: nullCommandHandler
    });
    let validator: (commandHelp: CommandHelp) => void = undefined;

    it('can be added to a root node', () => {
        addHelpCommand(root, (commandHelp: CommandHelp) => {
            if (validator) {
                validator(commandHelp);
            }
        });
    });

    it('gets executed with no arguments', () => {
        const parser = new Parser.CommandParser(root);
        parser.advance(makeToken('help'));
        expect(parser.execute.bind(parser)).to.throw(/Incomplete command/);
    });

    it('gets executed with a command', () => {
        let validated = false;
        validator = (commandHelp: CommandHelp) => {
            expect(commandHelp.title).to.equal('show interface');
            expect(commandHelp.help).to.equal('Show an interface');
            validated = true;
        };
        const parser = new Parser.CommandParser(root);
        parser.advance(makeToken('help'));
        parser.advance(makeToken('show'));
        parser.advance(makeToken('interface'));
        parser.execute();
        expect(validated).to.be.true;
        validator = undefined;
    });

    it('handles subcommands', () => {
        let validated = false;
        validator = (commandHelp: CommandHelp) => {
            expect(commandHelp.title).to.equal('show');
            expect(commandHelp.help).to.equal('Show stuff');
            expect(commandHelp.subcommands[0].symbol).to.equal('interface');
            expect(commandHelp.subcommands[0].help).to.equal('Show an interface');
            validated = true;
        };
        const parser = new Parser.CommandParser(root);
        parser.advance(makeToken('help'));
        parser.advance(makeToken('show'));
        parser.execute();
        expect(validated).to.be.true;
        validator = undefined;
    });
});
