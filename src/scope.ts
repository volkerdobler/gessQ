'use strict';

import * as vscode from 'vscode';

export enum ScopeEnum {
  n, // normaler Scope
  c, // in einem Kommentar
  s, // in einem String
}

interface BlockComment {
  start: string;
  end: string;
}

export let lineCommentDelimiter: RegExp = /\/\//;
export let blockCommentDelimiter: Array<BlockComment> = [
  { start: '{', end: '}' },
  { start: '/*', end: '*/' },
];
export let stringRegExp: RegExp = /"|'/;

function escapeRegex(str: string): string {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function findBlockCommentStart(str: string): number {
  let result: number = -1;

  blockCommentDelimiter.forEach(function (value, index) {
    if (str.search(escapeRegex(value.start)) === 0) {
      result = index;
    }
  });

  return result;
}
export class Scope {
  private scopeArr: ScopeEnum[][] = [];

  constructor(
    document: vscode.TextDocument,
    lineComDel?: RegExp,
    BlCoDel?: Array<BlockComment>,
    strReg?: RegExp
  ) {
    let prevScope: ScopeEnum = ScopeEnum.n;
    let currScope: ScopeEnum = ScopeEnum.n;
    let nextScope: ScopeEnum = ScopeEnum.n;

    if (lineComDel) {
      exports.lineCommentDelimiter = lineComDel;
    }
    if (BlCoDel) {
      exports.blockCommentDelimiter = BlCoDel;
    }
    if (strReg) {
      exports.stringRegExp = strReg;
    }

    let stringStart: string = '';
    let prevChar: string = '';

    let commentType: number = -1;

    let lineComment: boolean = false;

    for (let line = 0; line < document.lineCount; line++) {
      this.scopeArr[line] = [];

      let lineStr = document.lineAt(line).text;

      if (lineComment) {
        lineComment = false;
        prevScope = ScopeEnum.n;
      }
      for (let char = 0; char < lineStr.length; char++) {
        currScope = prevScope;
        nextScope = prevScope;

        if (
          lineStr.substring(char).search(exports.lineCommentDelimiter) === 0 &&
          prevScope === ScopeEnum.n
        ) {
          currScope = ScopeEnum.c;
          nextScope = ScopeEnum.c;
          lineComment = true;
        }
        if (
          prevScope === ScopeEnum.n &&
          (commentType = findBlockCommentStart(lineStr.substring(char))) > -1
        ) {
          currScope = ScopeEnum.c;
          nextScope = ScopeEnum.c;
        }
        if (
          prevScope === ScopeEnum.c &&
          !lineComment &&
          commentType > -1 &&
          lineStr
            .substring(char)
            .search(exports.blockCommentDelimiter[commentType].end) === 0 &&
          prevChar !== '\\'
        ) {
          currScope = ScopeEnum.c;
          nextScope = ScopeEnum.n;
          commentType = -1;
        }
        if (
          lineStr[char] === stringStart &&
          prevScope === ScopeEnum.s &&
          prevChar !== '\\'
        ) {
          currScope = ScopeEnum.s;
          nextScope = ScopeEnum.n;
        }
        if (
          lineStr.substring(char).search(exports.stringRegExp) === 0 &&
          prevScope === ScopeEnum.n
        ) {
          currScope = ScopeEnum.s;
          nextScope = ScopeEnum.s;
          stringStart = lineStr[char];
        }
        prevScope = nextScope;
        this.scopeArr[line][char] = currScope;
        prevChar = lineStr[char];
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

  public isNoSpecialScope(x: number, y: number): boolean {
    return this.getScope(x, y) === ScopeEnum.n;
  }

  public isInComment(x: number, y: number): boolean {
    return this.getScope(x, y) === ScopeEnum.c;
  }

  public isInString(x: number, y: number): boolean {
    return this.getScope(x, y) === ScopeEnum.s;
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
