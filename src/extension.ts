'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import cp = require('child_process');
import path = require('path');
import fs = require('fs');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "gessQ" is now active!');

    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(
        {language: "gessq"}, new GessQDocumentSymbolProvider()
    ));

    context.subscriptions.push(vscode.languages.registerDefinitionProvider(
        {language: "gessq"}, new GessQDefinitionProvider()));

};

// this method is called when your extension is deactivated
export function deactivate() {
};

// Workaround for issue in https://github.com/Microsoft/vscode/issues/9448#issuecomment-244804026
export function fixDriveCasingInWindows(pathToFix: string): string {
	return (process.platform === 'win32' && pathToFix) ? pathToFix.substr(0, 1).toUpperCase() + pathToFix.substr(1) : pathToFix;
}

export function getWorkspaceFolderPath(fileUri?: vscode.Uri): string {
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


class GessQDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    public provideDocumentSymbols(document: vscode.TextDocument,
            token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[]> {
        return new Promise((resolve, reject) => {

            var symbols = [];
            var questreg = new RegExp(/^\b(singleq|multiq|singlegridq|multigridq|openq|textq|numq|group)\s+([\w]+)/i);
            var blockreg = new RegExp(/^\b(block|screen)\s+([\w]+)/i);

            for (var i = 0; i < document.lineCount; i++) {
                var line = document.lineAt(i);
                if (line.text.search(questreg) > -1) {
                    symbols.push({
                        name: line.text.match(questreg)[2],
                        kind: vscode.SymbolKind.Variable,
                        location: new vscode.Location(document.uri, line.range),
                        containerName: line.text.match(questreg)[1]
                    })
                };
                if (line.text.search(blockreg) > -1) {
                    symbols.push({
                        name: line.text.match(blockreg)[2],
                        kind: vscode.SymbolKind.Method,
                        location: new vscode.Location(document.uri, line.range),
                        containerName: line.text.match(blockreg)[1]
                    })
                };
            }

            resolve(symbols);
        });
    }
}

export function adjustWordPosition(document: vscode.TextDocument, position: vscode.Position): [boolean, string, vscode.Position] {
    const wordRange = document.getWordRangeAtPosition(position);
    const lineText = document.lineAt(position.line).text;
    const word = wordRange ? document.getText(wordRange) : '';
    if (!wordRange) {
        return [false, null, null];
    }
    if (position.isEqual(wordRange.end) && position.isAfter(wordRange.start)) {
        position = position.translate(0, -1);
    }

    return [true, word, position];
}

class GessQDefinitionProvider implements vscode.DefinitionProvider {
    public provideDefinition(document: vscode.TextDocument, position: vscode.Position, 
            token: vscode.CancellationToken): Thenable<vscode.Location> {

      const adjustedPos = adjustWordPosition(document, position);

      return new Promise((resolve, reject) => {
        
        if (!adjustedPos[0]) {
          return Promise.resolve(null);
        }
        const word = adjustedPos[1];
        var position = adjustedPos[2];

        var questre = new RegExp("\\b(singleq|multiq|singlegridq|multigridq|openq|textq|numq|group)\\s+("+word+")\\b", "");
        var blockre = new RegExp("\\b(block|screen)\\s+("+word+")\\b\\s*=", "");

        var wsfolder = getWorkspaceFolderPath(document.uri) || fixDriveCasingInWindows(path.dirname(document.fileName));
        
        fs.readdirSync(wsfolder).forEach(file => {
            let regEXP = new RegExp("\.(q|inc)$");
            let ok = file.match(regEXP);
            if (ok) {
              vscode.workspace.openTextDocument(wsfolder + "\\" + file).then(
                function(content) {
                  for (var i = 0; i < content.lineCount; i++) {
                    var line = content.lineAt(i);
                    if (line.text.search(questre) > -1) {
                      let loc = new vscode.Location(content.uri, line.range);
                      resolve(loc);
                    };
                    if (line.text.search(blockre) > -1) {
                      let loc = new vscode.Location(content.uri, line.range);
                      resolve(loc);
                    };
                  };
                  resolve(null);
                },
                function(reason) {
                  resolve(null);
                }
              );
            };
            // resolve(locarray[0]);
          });
        });
    //     for (var i = 0; i < document.lineCount; i++) {
    //         var line = document.lineAt(i);
    //         if (line.text.search(questre) > -1) {
    //             var loc = new vscode.Location(document.uri, line.range);
    //         };
    //     }
    //     resolve(loc);
    //   })
    }
}

