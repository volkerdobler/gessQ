'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
// import path = require('path');
import * as path from 'path';
// import fs = require('fs');
import * as fs from 'fs';
// import resolve = require('path');
// import readdir = require('fs');

import * as sc from './scope';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): any {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "gessQ" is now active!');

  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      { language: 'gessq', scheme: 'file' },
      new GessQDocumentSymbolProvider()
    )
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      { language: 'gessq', scheme: 'file' },
      new GessQDefinitionProvider()
    )
  );

  context.subscriptions.push(
    vscode.languages.registerReferenceProvider(
      { language: 'gessq', scheme: 'file' },
      new GessQReferenceProvider()
    )
  );

  context.subscriptions.push(
    vscode.languages.registerWorkspaceSymbolProvider(
      new GessQWorkspaceSymbolProvider()
    )
  );

  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider(
      {
        language: 'gessq',
        scheme: 'file',
      },
      new GessQFoldingRangeProvider()
    )
  );
}

// Workaround for issue in https://github.com/Microsoft/vscode/issues/9448#issuecomment-244804026
function fixDriveCasingInWindows(pathToFix: string): string {
  return process.platform === 'win32' && pathToFix
    ? pathToFix.substr(0, 1).toUpperCase() + pathToFix.substr(1)
    : pathToFix;
}

function getWorkspaceFolderPath(fileUri?: vscode.Uri): string | undefined {
  if (fileUri) {
    const workspace = vscode.workspace.getWorkspaceFolder(fileUri);
    if (workspace) {
      return fixDriveCasingInWindows(workspace.uri.fsPath);
    } else {
      return;
    }
  }
  // fall back to the first workspace
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length) {
    return fixDriveCasingInWindows(folders[0].uri.fsPath);
  }
}

const constTokenVarNameRest = '(?:[A-Za-zÄÖÜßäöü\\w\\$]*)';

const constTokenVarName =
  '(?:\\b(?:[A-Za-zÄÖÜßäöü])' + constTokenVarNameRest + '\\b)';

const constStringVarName = '(?:"[^"]+")|(?:\'[^\']+\')';

const constVarName: string =
  '(?:' + constTokenVarName + '|' + constStringVarName + ')';

const constVarList: string =
  '(' + constVarName + '(?:\\s+(?:' + constVarName + '))*)';
const constVarToList: string =
  '(?:' + constVarList + '\\s*\\bto\\b\\s*' + constVarList + ')';

const constAllVarList: string =
  '(?:' + constVarToList + '|' + constVarList + ')';

function getWordDefinition(word: string): string {
  return '(?:(?:\\b' + word + '\\b)|(?:"' + word + '")|(?:\'' + word + "'))";
}

const questionDefRe = function (word: string): RegExp {
  const questConst =
    '(singleq|multiq|singlegridq|multigridq|openq|textq|numq|group)';

  let retVal = '';
  if (word && word.length > 0) {
    retVal = '\\b' + questConst + '\\b\\s*' + getWordDefinition(word);
  } else {
    retVal = '\\b' + questConst + '\\b\\s(' + constVarName + ')';
  }
  return new RegExp(retVal, 'i');
};

const definitionDefRe = function (word: string): RegExp {
  const questConst = '(opennumformat)';

  let retVal = '';
  if (word && word.length > 0) {
    retVal = '\\b' + questConst + '\\b\\s*' + getWordDefinition(word);
  } else {
    retVal = '\\b' + questConst + '\\b\\s(' + constVarName + ')';
  }
  return new RegExp(retVal, 'i');
};

const blockDefRe = function (word: string): RegExp {
  const blockConst = '(block|screen)';

  let retName = '';
  if (word && word.length > 0) {
    retName = getWordDefinition(word);
  } else {
    retName = constVarName;
  }
  return new RegExp(
    '\\b' + blockConst + '\\b\\s*(' + retName + ')\\b\\s*=',
    'i'
  );
};

const blockRe = function (word: string): RegExp {
  const blockConst = '(?:block)';
  const screenConst = '(?:screen)';

  let retVal = '';
  if (word && word.length > 0) {
    retVal = getWordDefinition(word);
  } else {
    retVal = constVarName;
  }

  return new RegExp(
    '\\b' +
      '(?:(' +
      blockConst +
      '|' +
      screenConst +
      ')\\b.*' +
      retVal +
      '\\b\\s*=)' +
      '|' +
      '(?:' +
      blockConst +
      '\\b[^=]*=\\s*\\(.*\\b' +
      retVal +
      '\\b)' +
      '|' +
      '(?:' +
      screenConst +
      '\\b[^=]*=\\s*\\b(column|row)?\\b\\s*\\(.*\\b' +
      retVal +
      '\\b)',
    'i'
  );
};

const checkRe = function (word: string): RegExp {
  let retVal = '';

  if (word && word.length > 0) {
    retVal = getWordDefinition(word);
  } else {
    retVal = constVarName;
  }

  return new RegExp(
    '(?:in\\s*\\b' +
      retVal +
      '\\b)|(?:\\b' +
      retVal +
      '\\b\\s*(?:eq|ne|le|ge|lt|gt))\\b',
    'i'
  );
};

const assertRe = function (word: string): RegExp {
  let retVal: string;

  if (word && word.length > 0) {
    retVal = getWordDefinition(word);
  } else {
    retVal = constVarName;
  }

  return new RegExp('\\bassert\\s+\\(.*\\b' + retVal + '\\b', 'i');
};

const computeRe = function (word: string): RegExp {
  let retVal: string;

  if (word && word.length > 0) {
    retVal = getWordDefinition(word);
  } else {
    retVal = constVarName;
  }

  return new RegExp('\\bcompute\\b\\s*.+\\b' + retVal + '\\b', 'i');
};

const actionBlockDefRe = function (word: string): RegExp {
  let retVal: string;

  if (word && word.length > 0) {
    retVal = getWordDefinition(word);
  } else {
    retVal = constVarName;
  }

  return new RegExp(
    '\\b(load|set)\\b\\s*\\(?:\\s*(?:' + retVal + '\\s*=)',
    'i'
  );
};

const actionBlockRe = function (word: string): RegExp {
  let retVal: string;

  if (word && word.length > 0) {
    retVal = getWordDefinition(word);
  } else {
    retVal = constVarName + '|(?:[^=]+)';
  }

  return new RegExp('\\b(load|set)\\s*\\(\\s*(?:(' + retVal + ')\\s*=)', 'i');
};

const macroDefRe = function (word: string): RegExp {
  let retVal: string;

  if (word && word.length > 0) {
    retVal = getWordDefinition(word);
  } else {
    retVal = constVarName;
  }

  return new RegExp('\\b#(macro)\\b\\s*#' + retVal, 'i');
};

// sucht das Wort unter dem Cursor, wobei Zahlen, Buchstaben, Punkte sowie # als
// Wort akzeptiert werden. Gibt dann einen Array zurück, wobei das 1st Element
// true ist, wenn es ein Wort gefunden hat, sonst false. Das eigentliche Wort
// steht dann an zweiter Stelle (wenn true)
function getWordAtPosition(
  document: vscode.TextDocument,
  position: vscode.Position
): [boolean, string, vscode.Position] {
  const wordRange = document.getWordRangeAtPosition(position);
  const word = wordRange ? document.getText(wordRange) : '';
  if (!wordRange) {
    return [false, '', position];
  }
  if (position.isEqual(wordRange.end) && position.isAfter(wordRange.start)) {
    position = position.translate(0, -1);
  }

  return [true, word, position];
}

function getAllFilenamesInDirectory(dir: string, fType: string): string[] {
  let results: string[] = [];
  const regEXP = new RegExp('\\.' + fType + '$', 'i');
  const list = fs.readdirSync(dir, {
    encoding: 'utf8',
    withFileTypes: true,
  });

  list.forEach(function (file: fs.Dirent) {
    const fileInclDir = dir + '\\' + file.name;
    if (file.isDirectory()) {
      /* dive into a subdirectory */
      results = results.concat(getAllFilenamesInDirectory(fileInclDir, fType));
    } else {
      /* Is a file */
      // results.push(file);
      if (file.isFile() && file.name.match(regEXP)) {
        results.push(fileInclDir);
      }
    }
  });
  return results;
}

async function getDefLocationInDocument(
  filename: string,
  word: string
): Promise<vscode.Location> {
  let locPosition: vscode.Location;

  const questionRegExp = questionDefRe(word);
  const definitionRegExp = definitionDefRe(word);
  const blockRegExp = blockDefRe(word);

  return vscode.workspace.openTextDocument(filename).then((content) => {
    const scope = new sc.Scope(content);

    for (let i = 0; i < content.lineCount; i++) {
      const line = content.lineAt(i);
      if (line.text.length === 0) {
        continue;
      }

      if (
        scope.isNotInComment(i, line.text.search(questionRegExp)) ||
        scope.isNotInComment(i, line.text.search(definitionRegExp)) ||
        scope.isNotInComment(i, line.text.search(blockRegExp))
      ) {
        locPosition = new vscode.Location(content.uri, line.range);
      }
    }
    if (!locPosition) {
      Promise.reject('No definition found');
    }
    return locPosition;
  });
}

// sucht alle Stellen, an denen die Variable genutzt wird, also nicht nur, wo
// sie definiert wird, sondern auch in tables.
async function getAllLocationInDocument(
  filename: string,
  word: string
): Promise<vscode.Location[]> {
  const locArray: vscode.Location[] = [];

  const questionDefRegExp = questionDefRe(word);
  const definitionDefRegExp = definitionDefRe(word);
  const blockDefRegExp = blockDefRe(word);
  const blockRegExp = blockRe(word);
  const checkRegExp = checkRe(word);
  const assertRegExp = assertRe(word);
  const computeRegExp = computeRe(word);
  const actionBlockRegExp = actionBlockDefRe(word);

  return vscode.workspace.openTextDocument(filename).then((content) => {
    const scope = new sc.Scope(content);

    for (let i = 0; i < content.lineCount; i++) {
      const line = content.lineAt(i);
      if (line.text.length === 0) {
        continue;
      }

      if (
        scope.isNotInComment(i, line.text.search(questionDefRegExp)) ||
        scope.isNotInComment(i, line.text.search(definitionDefRegExp)) ||
        scope.isNotInComment(i, line.text.search(blockDefRegExp)) ||
        scope.isNotInComment(i, line.text.search(blockRegExp)) ||
        scope.isNotInComment(i, line.text.search(checkRegExp)) ||
        scope.isNotInComment(i, line.text.search(assertRegExp)) ||
        scope.isNotInComment(i, line.text.search(computeRegExp)) ||
        scope.isNotInComment(i, line.text.search(actionBlockRegExp))
      ) {
        locArray.push(new vscode.Location(content.uri, line.range));
      }
    }
    return locArray;
  });
}

// Allow the user to see the definition of variables/functions/methods
// right where the variables / functions / methods are being used.
class GessQDefinitionProvider implements vscode.DefinitionProvider {
  public provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Thenable<vscode.Location> {
    const adjustedPos = getWordAtPosition(document, position);

    return new Promise((resolve, reject) => {
      if (!adjustedPos[0]) {
        reject('No definition found');
        return;
      }
      const word = adjustedPos[1];

      const wsFolder =
        getWorkspaceFolderPath(document.uri) ||
        fixDriveCasingInWindows(path.dirname(document.fileName));

      const fileNames: string[] = getAllFilenamesInDirectory(wsFolder, 'q');

      if (fileNames.length === 0) {
        // vscode.window.showInformationMessage('No Q-files found in ' + wsFolder);
        reject('No Q-files found');
        return;
      }

      const locations = fileNames.map((file) =>
        getDefLocationInDocument(file, word)
      );
      // has to be a Promise as the OpenTextDocument is async and we have to
      // wait until it is fullfilled with all filenames.
      Promise.all(locations).then(function (content) {
        let found: boolean = false;
        content.forEach((loc) => {
          if (loc != null) {
            resolve(loc);
            found = true;
          }
        });
        if (!found) {
          reject('No definition found');
        }
      });
    });
  }
}

// Allow the user to see all the source code locations where a certain
// variable / function/ method / symbol is being used.
class GessQReferenceProvider implements vscode.ReferenceProvider {
  public provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    options: { includeDeclaration: boolean },
    token: vscode.CancellationToken
  ): Thenable<vscode.Location[]> {
    const wordAtPosition = getWordAtPosition(document, position);

    return new Promise((resolve) => {
      if (!wordAtPosition[0]) {
        return Promise.resolve(null);
      }
      const word = wordAtPosition[1];

      const loclist: vscode.Location[] = [];

      const wsFolder =
        getWorkspaceFolderPath(document.uri) ||
        fixDriveCasingInWindows(path.dirname(document.fileName));

      const fileNames: string[] = getAllFilenamesInDirectory(wsFolder, 'q');

      const locations = fileNames.map((file) =>
        getAllLocationInDocument(file, word)
      );
      Promise.all(locations)
        .then(function (content) {
          content.forEach((loc) => {
            if (loc != null && loc[0] != null) {
              loc.forEach((arr) => {
                loclist.push(arr);
              });
            }
          });
          return loclist;
        })
        .then((result) => {
          resolve(result);
        });
      // .catch((e) => {
      //   resolve(null);
      // });
    });
  }
}

class GessQDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  public provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Thenable<vscode.SymbolInformation[]> {
    return new Promise((resolve) => {
      const symbols: vscode.SymbolInformation[] = [];

      function spush(
        kind: vscode.SymbolKind,
        container: string,
        m1: string,
        m2: string,
        m3: string,
        uri: vscode.Uri,
        range: vscode.Range
      ): void {
        const varName = new RegExp(
          '(' + constTokenVarName + ')|(' + constStringVarName + ')|(.+)'
        );
        function lpush(teststring: string): void {
          if (teststring && teststring.length > 0) {
            teststring = teststring.trim();
            symbols.push({
              name: teststring,
              kind: kind,
              location: new vscode.Location(uri, range),
              containerName: container,
            });
          }
        }

        lpush(m1);
        lpush(m2);
        lpush(m3);
      }

      const questionRegExp = questionDefRe('');
      const definitionRegExp = definitionDefRe('');
      const blockRegExp = blockDefRe('');
      const actionBlockRegExp = actionBlockRe('');

      const scope = new sc.Scope(document);

      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);

        if (line.text.length === 0) {
          continue;
        }

        if (scope.isNotInComment(i, line.text.search(questionRegExp))) {
          const lineMatch = line.text.match(questionRegExp);
          if (lineMatch) {
            spush(
              vscode.SymbolKind.Function,
              'question',
              lineMatch[2] + ' [' + lineMatch[1].toLocaleLowerCase() + ']',
              '',
              '',
              document.uri,
              line.range
            );
          }
        }
        if (scope.isNotInComment(i, line.text.search(definitionRegExp))) {
          const lineMatch = line.text.match(definitionRegExp);
          if (lineMatch) {
            spush(
              vscode.SymbolKind.Property,
              'definition',
              lineMatch[2] + ' [' + lineMatch[1].toLocaleLowerCase() + ']',
              '',
              '',
              document.uri,
              line.range
            );
          }
        }
        if (scope.isNotInComment(i, line.text.search(blockRegExp))) {
          const lineMatch = line.text.match(blockRegExp);
          if (lineMatch) {
            spush(
              vscode.SymbolKind.Module,
              'flow',
              lineMatch[2] + ' [' + lineMatch[1].toLocaleLowerCase() + ']',
              '',
              '',
              document.uri,
              line.range
            );
          }
        }
        if (scope.isNotInComment(i, line.text.search(actionBlockRegExp))) {
          const lineMatch = line.text.match(actionBlockRegExp);
          if (lineMatch) {
            spush(
              vscode.SymbolKind.Variable,
              'action',
              lineMatch[2]
                ? lineMatch[2] + ' [' + lineMatch[1].toLocaleLowerCase() + ']'
                : '',
              lineMatch[3]
                ? lineMatch[3] + ' [' + lineMatch[1].toLocaleLowerCase() + '}'
                : '',
              '',
              document.uri,
              line.range
            );
          }
        }
      }

      resolve(symbols);
    });
  }
}

class GessQWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
  public provideWorkspaceSymbols(
    query: string,
    token: vscode.CancellationToken
  ): Thenable<vscode.SymbolInformation[]> {
    const symbols: vscode.SymbolInformation[] = [];

    if (query.length > 0) {
      query = '(' + query + constTokenVarNameRest + ')';
    }

    const questionDefRegExp: RegExp = questionDefRe(query);
    const definitionDefRegExp: RegExp = definitionDefRe(query);
    const blockDefRegExp: RegExp = blockDefRe(query);
    const blockRegExp: RegExp = blockRe(query);
    const checkRegExp: RegExp = checkRe(query);
    const assertRegExp: RegExp = assertRe(query);
    const actionBlockRegExp: RegExp = actionBlockRe(query);
    const macroRegExp: RegExp = macroDefRe(query);

    const wsFolder =
      getWorkspaceFolderPath(
        vscode.window.activeTextEditor &&
          vscode.window.activeTextEditor.document.uri
      ) ||
      fixDriveCasingInWindows(
        path.dirname(
          vscode &&
            vscode.window &&
            vscode.window.activeTextEditor &&
            vscode.window.activeTextEditor.document
            ? vscode.window.activeTextEditor.document.fileName
            : ''
        )
      );

    return new Promise((resolve) => {
      getAllFilenamesInDirectory(wsFolder, '(q)').forEach((fileWithPath) => {
        vscode.workspace
          .openTextDocument(fileWithPath)
          .then(function (content) {
            const scope = new sc.Scope(content);

            function spush(
              kind: vscode.SymbolKind,
              container: string,
              m1: string,
              m2: string,
              m3: string,
              uri: vscode.Uri,
              range: vscode.Range
            ): void {
              const varName = new RegExp(
                '(' + constTokenVarName + ')|(' + constStringVarName + ')|(.+)'
              );

              function lpush(teststring: string): void {
                while (teststring && teststring.length > 0) {
                  teststring = teststring.trim();
                  const xname = teststring.match(varName);
                  if (xname) {
                    const pname = xname[2]
                      ? xname[2].substring(1, xname[2].length - 1)
                      : xname[1]
                      ? xname[1]
                      : xname[3];
                    symbols.push({
                      name: pname,
                      kind: kind,
                      location: new vscode.Location(uri, range),
                      containerName: container,
                    });
                    teststring = teststring.replace(xname[0], '');
                  }
                }
              }

              lpush(m1);
              lpush(m2);
              lpush(m3);
            }

            for (let i = 0; i < content.lineCount; i++) {
              const line = content.lineAt(i);

              if (line.text.length === 0) {
                continue;
              }
              if (
                scope.isNotInComment(i, line.text.search(questionDefRegExp))
              ) {
                const lineMatch = line.text.match(questionDefRegExp);
                if (lineMatch) {
                  spush(
                    vscode.SymbolKind.Function,
                    lineMatch[1],
                    lineMatch[2],
                    '',
                    '',
                    content.uri,
                    line.range
                  );
                }
              }
              if (
                scope.isNotInComment(i, line.text.search(definitionDefRegExp))
              ) {
                const lineMatch = line.text.match(definitionDefRegExp);
                if (lineMatch) {
                  spush(
                    vscode.SymbolKind.Function,
                    lineMatch[1],
                    lineMatch[2],
                    '',
                    '',
                    content.uri,
                    line.range
                  );
                }
              }
              if (scope.isNotInComment(i, line.text.search(blockDefRegExp))) {
                const lineMatch = line.text.match(blockDefRegExp);
                if (lineMatch) {
                  spush(
                    vscode.SymbolKind.Function,
                    lineMatch[1],
                    lineMatch[2],
                    '',
                    '',
                    content.uri,
                    line.range
                  );
                }
              }
              if (scope.isNotInComment(i, line.text.search(blockRegExp))) {
                const lineMatch = line.text.match(blockRegExp);
                if (lineMatch) {
                  spush(
                    vscode.SymbolKind.Function,
                    lineMatch[1],
                    lineMatch[2],
                    '',
                    '',
                    content.uri,
                    line.range
                  );
                }
              }
              if (scope.isNotInComment(i, line.text.search(checkRegExp))) {
                const lineMatch = line.text.match(checkRegExp);
                if (lineMatch) {
                  spush(
                    vscode.SymbolKind.Operator,
                    'check',
                    lineMatch[1],
                    '',
                    '',
                    content.uri,
                    line.range
                  );
                }
              }
              if (scope.isNotInComment(i, line.text.search(assertRegExp))) {
                const lineMatch = line.text.match(assertRegExp);
                if (lineMatch) {
                  spush(
                    vscode.SymbolKind.Operator,
                    'assertion',
                    lineMatch[1],
                    '',
                    '',
                    content.uri,
                    line.range
                  );
                }
              }
              if (
                scope.isNotInComment(i, line.text.search(actionBlockRegExp))
              ) {
                const lineMatch = line.text.match(actionBlockRegExp);
                if (lineMatch) {
                  spush(
                    vscode.SymbolKind.Operator,
                    lineMatch[1],
                    lineMatch[2],
                    '',
                    '',
                    content.uri,
                    line.range
                  );
                }
              }
              if (scope.isNotInComment(i, line.text.search(macroRegExp))) {
                const lineMatch = line.text.match(macroRegExp);
                if (lineMatch) {
                  spush(
                    vscode.SymbolKind.Variable,
                    'macro',
                    lineMatch[2],
                    '',
                    '',
                    content.uri,
                    line.range
                  );
                }
              }
            }
            return symbols;
          })
          .then((result) => {
            resolve(result);
          });
      });
    });
  }
}

class GessQFoldingRangeProvider implements vscode.FoldingRangeProvider {
  public provideFoldingRanges(
    document: vscode.TextDocument,
    context: vscode.FoldingContext,
    token: vscode.CancellationToken
  ): Thenable<vscode.FoldingRange[]> {
    return new Promise((resolve) => {
      const regions: {
        start: RegExp;
        end: RegExp;
        kind: vscode.FoldingRangeKind;
        len: number;
      }[] = [
        {
          start: /\B#macro\b/i,
          end: /\B#(endmacro|macroend)\b/i,
          kind: vscode.FoldingRangeKind.Region,
          len: 6,
        },
        {
          start: /\B#ifn?def\b/i,
          end: /\B#end(if)?\b/i,
          kind: vscode.FoldingRangeKind.Region,
          len: 4,
        },
        {
          start: /\{/i,
          end: /\}/,
          kind: vscode.FoldingRangeKind.Region,
          len: 1,
        },
        {
          start: /\B\/\*\B/,
          end: /\B\*\/\B/,
          kind: vscode.FoldingRangeKind.Comment,
          len: 2,
        },
      ];

      const foldingCollection: {
        start: number;
        end: number;
        kind: vscode.FoldingRangeKind;
      }[] = [];

      let foldingCounter: number = 0;
      let inComment = false;

      for (let l = 0; l < document.lineCount; l++) {
        let curLine = document.lineAt(l).text;

        let posLineComment = curLine.search(/\/\//);
        if (posLineComment > -1) {
          curLine = curLine.slice(0, posLineComment);
          if (curLine.length === 0) {
            continue;
          }
        }
        for (let loop = 0; loop < regions.length; loop++) {
          if (curLine.length === 0) {
            break;
          }

          if (curLine.search(/\}\s*else\s*\{/) > -1) {
            break;
          }
          let posRegionComplete = curLine.search(
            new RegExp(
              regions[loop].start.source + '.+?' + regions[loop].end.source,
              'i'
            )
          );

          // Wenn Start & End in einer Zeile, dann einfach ignorieren
          while (posRegionComplete > -1) {
            curLine =
              curLine.slice(0, curLine.search(regions[loop].start)) +
              curLine.slice(
                curLine.search(regions[loop].end) + regions[loop].len
              );
            posRegionComplete = curLine.search(
              new RegExp(
                regions[loop].start.source + '.+?' + regions[loop].end.source,
                'i'
              )
            );
          }
          let posStart = curLine.search(regions[loop].start);
          if (posStart > -1 && !inComment) {
            foldingCollection.push({
              start: l,
              end: -1,
              kind: regions[loop].kind,
            });
            foldingCounter = foldingCollection.length;
            curLine = curLine.slice(posStart + regions[loop].len);
            inComment = regions[loop].kind === vscode.FoldingRangeKind.Comment;
          }
          let posEnd = curLine.search(regions[loop].end);
          if (
            posEnd > -1 &&
            (regions[loop].kind === vscode.FoldingRangeKind.Comment ||
              !inComment)
          ) {
            while (
              foldingCounter > 0 &&
              foldingCollection[foldingCounter - 1].end > -1
            ) {
              foldingCounter--;
            }
            if (foldingCounter > 0) {
              let endLine =
                l - 1 > foldingCollection[foldingCounter - 1].start ? l - 1 : l;
              foldingCollection[--foldingCounter].end = endLine;
            }
            curLine = curLine.slice(posEnd + regions[loop].len + 1);
            inComment = false;
          }
        }
      }
      resolve(foldingCollection);
    });
  }
}
