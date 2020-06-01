'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import path = require('path');
import fs = require('fs');

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
      new GessQDocumentSymbolProvider(),
    ),
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider({ language: 'gessq', scheme: 'file' }, new GessQDefinitionProvider()),
  );

  context.subscriptions.push(
    vscode.languages.registerReferenceProvider({ language: 'gessq', scheme: 'file' }, new GessQReferenceProvider()),
  );

  context.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider(new GessQWorkspaceSymbolProvider()));
}

// Workaround for issue in https://github.com/Microsoft/vscode/issues/9448#issuecomment-244804026
function fixDriveCasingInWindows(pathToFix: string): string {
  return process.platform === 'win32' && pathToFix
    ? pathToFix.substr(0, 1).toUpperCase() + pathToFix.substr(1)
    : pathToFix;
}

function getWorkspaceFolderPath(fileUri?: vscode.Uri): string {
  if (fileUri) {
    const workspace = vscode.workspace.getWorkspaceFolder(fileUri);
    if (workspace) {
      return fixDriveCasingInWindows(workspace.uri.fsPath);
    }
  }

  // fall back to the first workspace
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length) {
    return fixDriveCasingInWindows(folders[0].uri.fsPath);
  }
}

function adjustWordPosition(
  document: vscode.TextDocument,
  position: vscode.Position,
): [boolean, string, vscode.Position] {
  const wordRange = document.getWordRangeAtPosition(position);
  const word = wordRange ? document.getText(wordRange) : '';
  if (!wordRange) {
    return [false, null, null];
  }
  if (position.isEqual(wordRange.end) && position.isAfter(wordRange.start)) {
    position = position.translate(0, -1);
  }

  return [true, word, position];
}

function getAllFiles(dir: string, fType: string): any[] {
  let results = [];
  const regEXP = new RegExp('\\.' + fType + '$', 'i');
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '\\' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      /* dive into a subdirectory */
      results = results.concat(getAllFiles(file, fType));
    } else {
      /* Is a file */
      // results.push(file);
      if (file.match(regEXP)) {
        results.push(file);
      }
    }
  });
  return results;
}

class GessQDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  public provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): Thenable<vscode.SymbolInformation[]> {
    return new Promise(resolve => {
      const symbols = [];

      const questreg = new RegExp(
        /^\b(singleq|multiq|singlegridq|multigridq|openq|textq|numq|group|compute)\s+([\w\.]+)/i,
      );
      const blockreg = new RegExp(/^\b(block|screen)\s+([\w\.]+)/i);
      const cABreg = new RegExp(/\b(load|set)\b\s*\(\s*([^=\s]+)\s*=/i);

      const scope = new sc.Scope(document);

      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);

        if (line.text.length === 0) {
          continue;
        }

        if (scope.isNoSpecialScope(i, line.text.search(questreg))) {
          symbols.push({
            name: line.text.match(questreg)[2],
            kind: vscode.SymbolKind.Variable,
            location: new vscode.Location(document.uri, line.range),
            containerName: line.text.match(questreg)[1].toLocaleLowerCase(),
          });
        }
        if (scope.isNoSpecialScope(i, line.text.search(blockreg))) {
          symbols.push({
            name: line.text.match(blockreg)[2],
            kind: vscode.SymbolKind.Method,
            location: new vscode.Location(document.uri, line.range),
            containerName: line.text.match(blockreg)[1].toLocaleLowerCase(),
          });
        }
        if (scope.isNoSpecialScope(i, line.text.search(cABreg))) {
          symbols.push({
            name: line.text.match(cABreg)[2],
            kind: vscode.SymbolKind.Variable,
            location: new vscode.Location(document.uri, line.range),
            containerName: line.text.match(cABreg)[1].toLocaleLowerCase(),
          });
        }
      }

      resolve(symbols);
    });
  }
}

function getDefLocationInDocument(filename: string, word: string): any {
  const questRe = new RegExp(
    '\\b(singleq|multiq|singlegridq|multigridq|openq|textq|numq|group|opennumformat)\\s+(' + word + ')\\b',
    'i',
  );
  const blockRe = new RegExp('\\b(block|screen)\\s+(' + word + ')\\b\\s*=', 'i');

  let locPosition: vscode.Location = null;

  return vscode.workspace.openTextDocument(filename).then(content => {
    const scope = new sc.Scope(content);

    for (let i = 0; i < content.lineCount; i++) {
      const line = content.lineAt(i);

      if (
        scope.isNoSpecialScope(i, line.text.search(questRe)) ||
        scope.isNoSpecialScope(i, line.text.search(blockRe))
      ) {
        locPosition = new vscode.Location(content.uri, line.range);
      }
    }
    return locPosition;
  });
}

class GessQDefinitionProvider implements vscode.DefinitionProvider {
  public provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Thenable<vscode.Location> {
    const adjustedPos = adjustWordPosition(document, position);

    return new Promise(resolve => {
      if (!adjustedPos[0]) {
        return Promise.resolve(null);
      }
      const word = adjustedPos[1];

      const wsFolder = getWorkspaceFolderPath(document.uri) || fixDriveCasingInWindows(path.dirname(document.fileName));
      let fileNames: string[] = [];

      fileNames = getAllFiles(wsFolder, 'q');
      const locations = fileNames.map(file => getDefLocationInDocument(file, word));
      Promise.all(locations)
        .then(function(content) {
          let locPos: vscode.Location = null;

          content.forEach(loc => {
            if (loc != null) {
              locPos = loc;
            }
          });

          return locPos;
        })
        .then(result => {
          resolve(result);
        });
    });
  }
}

function getAllLocationInDocument(filename: string, word: string): any {
  const questRe = new RegExp(
    '\\b(singleq|multiq|singlegridq|multigridq|openq|textq|numq|group|opennumformat)\\s+(' + word + ')\\b',
    'i',
  );
  const blockRe = new RegExp(
    '\\b(block|screen)\\s+(' + word + ')\\b[^=]*=|\\b(block)\\b[^=]*=\\s*\\(.*\\b(' + word + ')\\b',
    'i',
  );
  const screenRe = new RegExp('\\b(screen)\\b[^=]*=\\s*\\b(column|row)?\\b\\s*\\(.*\\b(' + word + ')\\b', 'i');
  const wordRe = new RegExp('(in\\s*\\b' + word + '\\b|\\b' + word + '\\b\\s*(eq|ne|le|ge|lt|gt))\\b', 'i');
  const assertReg = new RegExp('\\bassert\\s+\\(.*\\b(' + word + ')\\b', 'i');
  const computere = new RegExp('\\bcompute\\b\\s*.+\\b(' + word + ')\\b', 'i');
  const cabRe = new RegExp('\\b(load|set)\\b\\s*\\(\\s*(' + word + ')\\s*=', 'i');

  const locArray: vscode.Location[] = [];

  return vscode.workspace.openTextDocument(filename).then(content => {
    const scope = new sc.Scope(content);

    for (let i = 0; i < content.lineCount; i++) {
      const line = content.lineAt(i);

      if (
        scope.isNoSpecialScope(i, line.text.search(questRe)) ||
        scope.isNoSpecialScope(i, line.text.search(blockRe)) ||
        scope.isNoSpecialScope(i, line.text.search(screenRe)) ||
        scope.isNoSpecialScope(i, line.text.search(wordRe)) ||
        scope.isNoSpecialScope(i, line.text.search(assertReg)) ||
        scope.isNoSpecialScope(i, line.text.search(computere)) ||
        scope.isNoSpecialScope(i, line.text.search(cabRe))
      ) {
        locArray.push(new vscode.Location(content.uri, line.range));
      }
    }
    return locArray;
  });
}

class GessQReferenceProvider implements vscode.ReferenceProvider {
  public provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    options: { includeDeclaration: boolean },
    token: vscode.CancellationToken,
  ): Thenable<vscode.Location[]> {
    const adjustedPos = adjustWordPosition(document, position);

    return new Promise(resolve => {
      if (!adjustedPos[0]) {
        return Promise.resolve(null);
      }
      const word = adjustedPos[1];

      const loclist: vscode.Location[] = [];

      const wsFolder = getWorkspaceFolderPath(document.uri) || fixDriveCasingInWindows(path.dirname(document.fileName));
      let fileNames: string[] = [];

      fileNames = getAllFiles(wsFolder, 'q');
      const locations = fileNames.map(file => getAllLocationInDocument(file, word));
      Promise.all(locations)
        .then(function(content) {
          content.forEach(loc => {
            if (loc != null && loc[0] != null) {
              loc.forEach(arr => {
                loclist.push(arr);
              });
            }
          });
          return loclist;
        })
        .then(result => {
          resolve(result);
        })
        .catch(e => {
          resolve(null);
        });
    });
  }
}

class GessQWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
  public provideWorkspaceSymbols(query: string, token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[]> {
    if (query.length === 0) {
      return null;
    }

    const symbols = [];

    const questRe = new RegExp(
      '\\b(singleq|multiq|singlegridq|multigridq|openq|textq|numq|group|opennumformat)\\s+(\\w*' + query + '\\w*)\\b',
      'i',
    );
    const blockRe = new RegExp('\\b(block)\\b.*\\b(\\w*' + query + '\\w*)\\b', 'i');
    const screenRe = new RegExp('\\b(screen)\\b.*\\b(\\w*' + query + '\\w*)\\b', 'i');
    const bedingungReg = new RegExp(
      '((\\w+\\s+in)\\s*\\b(\\w*' + query + '\\w*)\\b|\\b(\\w*' + query + '\\w*)\\b\\s*(eq|ne|le|ge|lt|gt)\\s+\\w+)\\b',
      'i',
    );
    const assertReg = new RegExp('\\b(assert)\\b.*(\\b(\\w*' + query + '\\w*)\\b)', 'i');
    const computere = new RegExp('\\b(compute)\\b.*\\b(\\w*' + query + '\\w*)\\b', 'i');

    const wsFolder =
      getWorkspaceFolderPath(vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri) ||
      fixDriveCasingInWindows(path.dirname(vscode.window.activeTextEditor.document.fileName));

    return new Promise(resolve => {
      getAllFiles(wsFolder, '(q|inc)').forEach(file => {
        vscode.workspace
          .openTextDocument(wsFolder + '\\' + file)
          .then(function(content) {
            const scope = new sc.Scope(content);

            for (let i = 0; i < content.lineCount; i++) {
              const line = content.lineAt(i);

              if (line.text.search(query) > -1) {
                if (scope.isNoSpecialScope(i, line.text.search(questRe))) {
                  symbols.push({
                    name: line.text.match(questRe)[2],
                    kind: vscode.SymbolKind.Function,
                    location: new vscode.Location(content.uri, line.range),
                    containerName: line.text.match(questRe)[1],
                  });
                }
                if (scope.isNoSpecialScope(i, line.text.search(blockRe))) {
                  symbols.push({
                    name: line.text.match(blockRe)[2],
                    kind: vscode.SymbolKind.Function,
                    location: new vscode.Location(content.uri, line.range),
                    containerName: line.text.match(blockRe)[1],
                  });
                }
                if (scope.isNoSpecialScope(i, line.text.search(screenRe))) {
                  symbols.push({
                    name: line.text.match(screenRe)[2],
                    kind: vscode.SymbolKind.Function,
                    location: new vscode.Location(content.uri, line.range),
                    containerName: line.text.match(screenRe)[1],
                  });
                }
                if (scope.isNoSpecialScope(i, line.text.search(assertReg))) {
                  symbols.push({
                    name: line.text.match(assertReg)[2],
                    kind: vscode.SymbolKind.Operator,
                    location: new vscode.Location(content.uri, line.range),
                    containerName: 'assert',
                  });
                }
                if (scope.isNoSpecialScope(i, line.text.search(bedingungReg))) {
                  let namestr = '';
                  if (line.text.match(bedingungReg)[3] == null) {
                    namestr = line.text.match(bedingungReg)[4];
                  } else {
                    namestr = line.text.match(bedingungReg)[3];
                  }
                  symbols.push({
                    name: namestr,
                    kind: vscode.SymbolKind.Operator,
                    location: new vscode.Location(content.uri, line.range),
                    containerName: 'filter',
                  });
                }
                if (scope.isNoSpecialScope(i, line.text.search(computere))) {
                  symbols.push({
                    name: line.text.match(computere)[2],
                    kind: vscode.SymbolKind.Variable,
                    location: new vscode.Location(content.uri, line.range),
                    containerName: line.text.match(computere)[1],
                  });
                }
              }
            }
            return symbols;
          })
          .then(result => {
            resolve(result);
          });
      });
    });
  }
}
