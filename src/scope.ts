'use strict';

import * as vscode from 'vscode';

export enum ScopeEnum {
  normal, // normaler Scope
  comment, // in einem Kommentar
  string // in einem String
}

interface Delimiter {
  start: string;
  end: string;
}

export const lineCommentDelimiter = /\/\//;
export const blockCommentDelimiter: Array<Delimiter> = [
  { start: '/*', end: '*/' }
];
export const stringDelimiter: Array<Delimiter> = [
  { start: '"', end: '"' },
  { start: "'", end: "'" }
];

function escapeRegex(str: string): string {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function findBlockCommentStart(str: string): [number, number] {
  let result = -1;
  let cType = -1;

  blockCommentDelimiter.forEach(function(value, index) {
    if (str.search(escapeRegex(value.start)) === 0) {
      result = value.start.length;
      cType = index;
    }
  });

  return [result, cType];
}

function findBlockCommentEnd(str: string, comIndex: number): number {
  let result = -1;

  blockCommentDelimiter.forEach(function(value, index) {
    if (str.search(escapeRegex(value.end)) === 0 && index === comIndex) {
      result = value.end.length;
    }
  });

  return result;
}

function findStringStart(str: string): [number, number] {
  let result = -1;
  let sIndex = -1;

  stringDelimiter.forEach(function(value, index) {
    if (str.search(escapeRegex(value.start)) === 0) {
      result = value.start.length;
      sIndex = index;
    }
  });

  return [result, sIndex];
}

function findStringEnd(str: string, sIndex: number): number {
  let result = -1;

  stringDelimiter.forEach(function(value, index) {
    if (str.search(escapeRegex(value.end)) === 0 && index === sIndex) {
      result = value.end.length;
    }
  });

  return result;
}

export class Scope {
  private scopeArr: ScopeEnum[][] = [];

  constructor(
    document: vscode.TextDocument,
    lineComDel?: RegExp,
    BlCoDel?: Array<Delimiter>,
    strReg?: Array<Delimiter>
  ) {
    if (lineComDel) {
      exports.lineCommentDelimiter = lineComDel;
    }
    if (BlCoDel) {
      exports.blockCommentDelimiter = BlCoDel;
    }
    if (strReg) {
      exports.stringRegExp = strReg;
    }

    let currScope: ScopeEnum = ScopeEnum.normal;

    let comStart = -1;
    let comIndex = -1;
    let strStart = -1;
    let strIndex = -1;
    let lineComment = false;

    for (let line = 0; line < document.lineCount; line++) {
      this.scopeArr[line] = [];

      const lineStr = document.lineAt(line).text;

      if (lineStr.length === 0) {
        continue;
      }

      let char = 0;

      while (char < lineStr.length) {
        if (currScope !== ScopeEnum.comment) {
          [comStart, comIndex] = findBlockCommentStart(lineStr.substring(char));
          lineComment =
            lineStr.substring(char).search(exports.lineCommentDelimiter) === 0;
          [strStart, strIndex] = findStringStart(lineStr.substring(char));
        }
        const comEnde = findBlockCommentEnd(lineStr.substring(char), comIndex);
        const strEnde = findStringEnd(lineStr.substring(char), strIndex);

        if (lineComment) {
          for (let loop = char; loop < lineStr.length; loop++) {
            this.scopeArr[line][loop] = ScopeEnum.comment;
          }
          break;
        }
        // aktuell nicht in einem Kommentar, also testen nach ...
        if (currScope !== ScopeEnum.comment) {
          // ... 1. ist es ein neuer Kommentar?
          if (comStart > -1) {
            for (
              let loop = char;
              loop < blockCommentDelimiter[comIndex].start.length;
              loop++
            ) {
              this.scopeArr[line][loop] = ScopeEnum.comment;
            }
            char += blockCommentDelimiter[comIndex].start.length;
            currScope = ScopeEnum.comment;
          }
          // ... 2. ist es der Beginn eines Strings?
          if (strStart > -1) {
            for (
              let loop = char;
              loop < stringDelimiter[strIndex].start.length;
              loop++
            ) {
              this.scopeArr[line][loop] = ScopeEnum.string;
            }
            char += stringDelimiter[strIndex].start.length;
            currScope = ScopeEnum.string;
          }
          if (strEnde > -1) {
            for (
              let loop = char;
              loop < stringDelimiter[strIndex].end.length;
              loop++
            ) {
              this.scopeArr[line][loop] = ScopeEnum.string;
            }
            char += stringDelimiter[strIndex].end.length;
            currScope = ScopeEnum.normal;
          }
          if (comStart === -1 && strStart === -1 && strEnde === -1) {
            this.scopeArr[line][char] = ScopeEnum.normal;
          }
        } else {
          if (comEnde > -1) {
            for (
              let loop = char;
              loop < blockCommentDelimiter[comIndex].end.length;
              loop++
            ) {
              this.scopeArr[line][loop] = ScopeEnum.comment;
            }
            char += blockCommentDelimiter[comIndex].end.length;
            currScope = ScopeEnum.normal;
          } else {
            this.scopeArr[line][char] = ScopeEnum.comment;
          }
        }
        char++;
      }
    }
  }

  public getScope(x: number, y: number): ScopeEnum | undefined {
    return x >= 0 &&
      x < this.scopeArr.length &&
      y >= 0 &&
      y < this.scopeArr[x].length
      ? this.scopeArr[x][y]
      : undefined;
  }

  public isNormalScope(x: number, y: number): boolean {
    return this.getScope(x, y) === ScopeEnum.normal;
  }

  public isCommentScope(x: number, y: number): boolean {
    return this.getScope(x, y) === ScopeEnum.comment;
  }

  public isNotInComment(x: number, y: number): boolean {
    return this.isNormalScope(x, y) || this.isStringScope(x, y);
  }

  public isStringScope(x: number, y: number): boolean {
    return this.getScope(x, y) === ScopeEnum.string;
  }
}

/*
  function readScopes(document: vscode.TextDocument): string[] {
  const normalScope = '-';
  const commentScope = 'c';
  const stringScope = 's';

  let prevScope: string = normalScope;
  let currScope: string = normalScope;
  let stringStart: string = '';

  let lineComment: boolean = false;

  let scopeArr: string[] = [];

  for (let line = 0; line < document.lineCount; line++) {
    let lineScope: string = '';
    let checkScope: string = '';
    let lineStr = document.lineAt(line).text;

    if (lineComment) {
      lineComment = false;
      prevScope = normalScope;
    }

    for (let char = 0; char < lineStr.length; char++) {
      checkScope = prevScope;
      currScope = prevScope;
      if (
        lineStr[char] === '/' &&
        char + 1 < lineStr.length &&
        lineStr[char + 1] === '/' &&
        prevScope === normalScope
      ) {
        currScope = commentScope;
        checkScope = currScope;
        lineComment = true;
      }
      if (lineStr[char] === '{' && prevScope === normalScope) {
        currScope = commentScope;
        checkScope = currScope;
      }
      if (lineStr[char] === '}' && prevScope === commentScope) {
        checkScope = prevScope;
        currScope = normalScope;
      }
      if (lineStr[char] === stringStart && prevScope === stringScope) {
        checkScope = prevScope;
        currScope = normalScope;
      }
      if (
        (lineStr[char] === "'" || lineStr[char] === '"') &&
        prevScope === normalScope
      ) {
        currScope = stringScope;
        checkScope = currScope;
        stringStart = lineStr[char];
      }
      prevScope = currScope;
      lineScope += checkScope;
    }
    scopeArr.push(lineScope);
  }

  return scopeArr;
}

function getScope(x: number, y: number, scopeArr: string[]): string {
  if (x >= 0 && y >= 0 && x < scopeArr.length && y < scopeArr[x].length) {
    return scopeArr[x].substr(y, 1);
  } else {
    return '';
  }
}

*/
