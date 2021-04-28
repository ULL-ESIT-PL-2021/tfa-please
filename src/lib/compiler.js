// @ts-check
/**
 * @description The file with the code to interpret the Please lang
 * @author Daniel del Castillo de la Rosa <alu0101225548@ull.edu.es>
 * @since 8/04/2021
 * @module PleaseLangCompiler
 */

'use strict';

const fs = require('fs');
const {unraw} = require('unraw');
const {Value, Word, Call} = require('./ast.js');

/**
 * The defition of whitespace in the Please language
 */
const WHITE = /^(?:\s|\/\/.*|\/\*(?:.|\n)*?\*\/)*/;

/**
 * A lexer class that takes care of the lexical analysis
 */
class Lexer {
  /**
   * The constructor of the lexer
   * @param {string} source The source code of the program to analyze
   */
  constructor(source) {
    /**
     * @const {string}
     * @private
     */
    this.source_= source.replace(/\r/g, '');
    /**
     * @property {Object}
     * @private
    */
    this.cachedToken_ = undefined;
    /**
     * @const {number}
     * @private
    */
    this.line_ = 1;
    /**
     * @const {number}
     * @private
    */
    this.column_ = 1;
    /**
     * @const {number}
     * @private
    */
    this.offset_ = 0;
    /**
     * @const {RegExp}
    */
    this.WHITE = WHITE;
    /**
     * @const {RegExp}
     * @private
    */
    this.REGEXP_ = new RegExp(
        [
          /(?<STRING>(["'])(?:[^\2\\]|\\.)*?\2)/,
          /(?<NUMBER>[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/,
          /(?<WORD>[^\s(){},"'\\]+)/,
          /(?<COMMA>,)/,
          /(?<LEFT_PARENTHESIS>[({])/,
          /(?<RIGHT_PARENTHESIS>[)}])/,
        ].map((regexp) => regexp.source).join('|'),
        'y',
    );
  }

  /**
   * A method that returns the next token of the source
   * @throws Will throw if there are invalid tokens
   */
  advanceToken() {
    this.skipSpace_();
    if (this.isEmpty()) {
      this.cachedToken_ = {type: 'EOF', line: this.line_, column: this.column_};
      return;
    }
    let match = this.REGEXP_.exec(this.source_);
    if (match == null) {
      match = /..*?\b|.*$/.exec(this.source_.slice(this.REGEXP_.lastIndex));
      throw new SyntaxError(
          `Invalid token: ${match[0]} ` +
          `at line ${this.line_} and column ${this.column_}`,
      );
    }
    this.cachedToken_ = this.constructResult_(match);
    this.cachedToken_.offset = this.offset_;
    this.cachedToken_.line = this.line_;
    this.cachedToken_.column = this.column_;
    this.updateAfterMatch_(match.groups[this.cachedToken_.type]);
  }

  /**
   * A helper function that construct the result from the match
   * @param {Object} match The string that matched with the RegExp
   * @return {Object} The constructed result
   * @private
   */
  constructResult_(match) {
    const result = {};
    result.type = Object.keys(match.groups)
        .find((type) => match.groups[type] !== undefined);
    if (result.type === 'WORD') {
      result.name = match.groups[result.type];
    } else if (result.type === 'NUMBER') {
      result.value = Number(match.groups[result.type]);
    } else if (result.type === 'STRING') {
      const string = match.groups[result.type];
      result.value = string.slice(1, string.length - 1);
      result.value = unraw(result.value);
    } else {
      result.value = match.groups[result.type];
    }
    return result;
  }

  /**
   * A method that returns the actual token
   * @return {Object} The actual token
   */
  getLookAhead() {
    return this.cachedToken_;
  }

  /**
   * A function to update the lexer after consuming a token
   * @param {string} token The token found
   * @private
   */
  updateAfterMatch_(token) {
    const lineStart = this.source_.lastIndexOf('\n', this.offset_);
    this.offset_ += token.length;
    this.column_ = this.offset_ - lineStart;
    this.line_ += token.split(/\n/).length - 1;
  }

  /**
   * A function to check if there are more tokens in the input
   * @return {boolean} Whether is it empty or not
   */
  isEmpty() {
    this.skipSpace_();
    return this.source_.length === this.offset_;
  }

  /**
   * A function that deletes starting whites from the source
   * @private
   */
  skipSpace_() {
    const match = this.WHITE.exec(this.source_.slice(this.offset_));
    this.REGEXP_.lastIndex += match[0].length;
    this.updateAfterMatch_(match[0]);
  };
}


/**
 * A function that parses an expression
 * @param {Lexer} lexer An instance of the Lexer class initialized with
 *     the source of the program
 * @return {Object} The JSON AST of the expression
 * @throws Will throw if there are syntactical errors
 */
const parseExpression = (lexer) => {
  const token = lexer.getLookAhead();
  if (token.type === 'WORD') {
    lexer.advanceToken();
    const expression = new Word(token);
    return parseCall(expression, lexer);
  }
  if (token.type === 'STRING' || token.type === 'NUMBER') {
    lexer.advanceToken();
    return new Value(token);
  }
  throw new SyntaxError(
      `Unexpected token: ${token.value} at line` +
      ` ${token.line} and column ${token.column}`,
  );
};

/**
 * A function that parses a call
 * @param {Object} operator The already parsed operator of the operator
 * @param {Lexer} lexer An instance of the Lexer class properly initialized
 * @return {Object} The JSON AST of the call
 * @throws Will throw if there are syntactical errors
 */
const parseCall = (operator, lexer) => {
  let token = lexer.getLookAhead();
  if (token.type === 'EOF' || token.type === 'RIGHT_PARENTHESIS' ||
     token.type === 'COMMA' || token.type === 'RIGHT_CURLY_BRACE') {
    return operator;
  }
  if (token.type !== 'LEFT_PARENTHESIS') {
    throw new SyntaxError(
        `Unexpected token: ${token.value} at line` +
        ` ${token.line} and column ${token.column}, expected '(' or '{'`,
    );
  }
  const finisher = token.value === '(' ? ')' : '}';
  lexer.advanceToken();
  token = lexer.getLookAhead();
  const args = [];
  while (token.value !== finisher) {
    if (token.type === 'EOF') {
      throw new SyntaxError(`Unexpected EOF`);
    }
    const arg = parseExpression(lexer);
    args.push(arg);
    token = lexer.getLookAhead();
    if (token.type === 'COMMA') {
      lexer.advanceToken();
      token = lexer.getLookAhead();
    } else if (token.value !== finisher) {
      throw new SyntaxError(
          `Expected ',' or '${finisher}' at line ${token.line} ` +
          `and column ${token.column}`,
      );
    }
  }
  const call = new Call(operator, args);
  lexer.advanceToken();
  return parseCall(call, lexer);
};

/**
 * A function that parses a Please program
 * @param {string} program The string with the unparsed program
 * @return {Object} The AST of the program
 * @throws Will throw if there are errors in the program
 */
const parse = (program) => {
  const lexer = new Lexer(program);
  lexer.advanceToken();
  const ast = parseExpression(lexer);
  if (lexer.getLookAhead().type !== 'EOF') {
    throw new SyntaxError('Unexpected text after program');
  }
  return ast;
};

/**
 * A function that reads a file and parses its contents
 * @param {string} fileName The name of the file
 * @return {Object} The JSON AST of the program
 * @throws Will throw if there are errors in the program or if the file
 *     can't be opened
 */
const parseFromFile = (fileName) => {
  const source = fs.readFileSync(fileName, 'utf8');
  return parse(source);
};

/**
 * A function that compiles a Please file
 * @param {string} origin The name of the origin file
 * @param {string} destination The name of the destination file
 * @throws Will throw if there are errors in the program or if the files
 *     can't be opened
 */
const compile = (origin, destination = undefined) => {
  const source = fs.readFileSync(origin, 'utf8');
  if (destination == undefined) {
    destination = origin.match(/^[^\.]*/)[0] + '.cpls';
  }
  const ast = JSON.stringify(parse(source), null, 2);
  fs.writeFileSync(destination, ast);
};

module.exports =
    {parse, parseCall, parseExpression, parseFromFile, compile, Lexer, WHITE};
