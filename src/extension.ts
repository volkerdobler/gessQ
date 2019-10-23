'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import path = require('path');
import fs = require('fs');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "gessQ" is now active!');

    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(
        {language: "gessq", scheme: "file"}, new GessQDocumentSymbolProvider()
    ));

    context.subscriptions.push(vscode.languages.registerDefinitionProvider(
        {language: "gessq", scheme: "file"}, new GessQDefinitionProvider()
    ));

    context.subscriptions.push(vscode.languages.registerReferenceProvider(
        {language: "gessq", scheme: "file"}, new GessQReferenceProvider()
    ));

    context.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider(
        new GessQWorkspaceSymbolProvider()));

};

// this method is called when your extension is deactivated
export function deactivate() {
};

// Workaround for issue in https://github.com/Microsoft/vscode/issues/9448#issuecomment-244804026
function fixDriveCasingInWindows(pathToFix: string): string {
	return (process.platform === 'win32' && pathToFix) ? pathToFix.substr(0, 1).toUpperCase() + pathToFix.substr(1) : pathToFix;
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

function adjustWordPosition(document: vscode.TextDocument, position: vscode.Position): [boolean, string, vscode.Position] {
    const wordRange = document.getWordRangeAtPosition(position);
    const word = wordRange ? document.getText(wordRange) : '';
    if (!wordRange) {
        return [false, null, null];
    }
    if (position.isEqual(wordRange.end) && position.isAfter(wordRange.start)) {
        position = position.translate(0, -1);
    }

    return [true, word, position];
};

function checkComment(command: number, startComment: number, endComment: number, commentStatus: number = 1): boolean {

  if (commentStatus === -1) {  // wir befinden uns in einem Kommentarbereich
    return false;
  };
  
  if (command > -1) {                // ist der reguläre Ausdruck vorhanden
    if (startComment > -1) {         // es wird ein Kommentar eröffnet
      if (endComment > -1) {         // es wird ein Kommentar geschlossen
        if (command < startComment || command > endComment) {  // entweder vor oder nach dem Kommentar
          return true;
        } else {
          return false;
        };
      } else {                       // nur Kommentar eröffnet
        if (command < startComment) {
          return true;
        } else {
          return false;
        }
      }
    } else {                         // kein Kommentar wird eröffnet
        if (endComment > -1) {       // Kommentar wird geschlossen
          if (command > endComment) {
            return true;
          } else {
            return false;
          };
        } else {                     // kein Kommentar wird geschlossen
          if (commentStatus < 0) {   // wir befinden uns bereits in einem Kommentar
            return false;
          } else {
            return true;             // nicht in einem Kommentar
          }
        }
    }
  } else {
    return false;
  };
}

class GessQDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    public provideDocumentSymbols(document: vscode.TextDocument,
            token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[]> {
        return new Promise((resolve) => {

            let curComment : number = 1;
            let nextComment : number = 0;

            var symbols = [];
            
            var questreg = new RegExp(/^\b(singleq|multiq|singlegridq|multigridq|openq|textq|numq|group|compute)\s+([\w\.]+)/i);
            var blockreg = new RegExp(/^\b(block|screen)\s+([\w\.]+)/i);
            var cABreg = new RegExp(/\b(load|set)\b\s*\(\s*([^=\s]+)\s*=/i);

            for (var i = 0; i < document.lineCount; i++) {
                var line = document.lineAt(i);

                let startComment: number = line.text.search("//");
                let endComment: number = line.text.search("\\*/");
                
                if (line.text.search("/\\*") > -1 && (startComment === -1 || line.text.search("/\\*") < startComment)){
                  startComment = line.text.search("/\\*");
                  endComment = line.text.search("\\*/");
                };
                
                if (checkComment(line.text.search(questreg),startComment,endComment,curComment)) {
                    symbols.push({
                        name: line.text.match(questreg)[2],
                        kind: vscode.SymbolKind.Variable,
                        location: new vscode.Location(document.uri, line.range),
                        containerName: line.text.match(questreg)[1]
                    })
                };
                if (checkComment(line.text.search(blockreg),startComment,endComment,curComment)) {
                    symbols.push({
                        name: line.text.match(blockreg)[2],
                        kind: vscode.SymbolKind.Method,
                        location: new vscode.Location(document.uri, line.range),
                        containerName: line.text.match(blockreg)[1]
                    })
                };
                if (checkComment(line.text.search(cABreg),startComment,endComment,curComment)) {
                    symbols.push({
                        name: line.text.match(cABreg)[2],
                        kind: vscode.SymbolKind.Variable,
                        location: new vscode.Location(document.uri, line.range),
                        containerName: line.text.match(cABreg)[1]
                    })
                };
                if (startComment !== line.text.search("//") && startComment > -1 && endComment === -1) {
                  curComment = -1;
                };
                if (endComment > -1) {
                  curComment = 1;
                }
            };
            
            resolve(symbols);
        });
    }
}

class GessQDefinitionProvider implements vscode.DefinitionProvider {
    public provideDefinition(document: vscode.TextDocument, position: vscode.Position, 
            token: vscode.CancellationToken): Thenable<vscode.Location> {

      const adjustedPos = adjustWordPosition(document, position);

      return new Promise((resolve) => {
        
        if (!adjustedPos[0]) {
          return Promise.resolve(null);
        }
        const word = adjustedPos[1];

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
                function() {
                  resolve(null);
                }
              );
            };
            // resolve(locarray[0]);
          });
        });
   }
}

class GessQReferenceProvider implements vscode.ReferenceProvider {
    public provideReferences(
        document: vscode.TextDocument, position: vscode.Position,
        options: { includeDeclaration: boolean }, token: vscode.CancellationToken):
        Thenable<vscode.Location[]> {

      const adjustedPos = adjustWordPosition(document, position);

      return new Promise((resolve) => {
        
        if (!adjustedPos[0]) {
          return Promise.resolve(null);
        }
        const word = adjustedPos[1];
        var locations = [];

        var questre = new RegExp("\\b(singleq|multiq|singlegridq|multigridq|openq|textq|numq|group)\\s+("+word+")\\b", "");
        var blockre = new RegExp("\\b(block)\\b[^=]*=\\s*\\(.*\\b("+word+")\\b", "");
        var screenre = new RegExp("\\b(screen)\\b[^=]*=\\s*\\b(column|row)?\\b\\s*\\(.*\\b("+word+")\\b", "");
        var wordre = new RegExp("(in\\s*\\b"+word+"\\b|\\b"+word+"\\b\\s*(eq|ne|le|ge|lt|gt))\\b", "");
        var assertre = new RegExp("\\bassert\\s+\\(.*\\b("+word+")\\b", "");
        var computere = new RegExp("\\bcompute\\b\\s*.+\\b("+word+")\\b", "");
        
        var wsfolder = getWorkspaceFolderPath(document.uri) || fixDriveCasingInWindows(path.dirname(document.fileName));
        
        fs.readdirSync(wsfolder).forEach(file => {
            let regEXP = new RegExp("\.(q|inc)$");
            let ok = file.match(regEXP);
            if (ok) {
              vscode.workspace.openTextDocument(wsfolder + "\\" + file).then(
                function(content) {
                  for (var i = 0; i < content.lineCount; i++) {
                    var line = content.lineAt(i);
                    if (line.text.search(questre) > -1 || line.text.search(blockre) > -1 || line.text.search(screenre) > -1 || line.text.search(wordre) > -1 || line.text.search(assertre) > -1 || line.text.search(computere) > -1) {
                      let loc = new vscode.Location(content.uri, line.range);
                      locations.push(loc);
                    };
                  };
                  if (locations.length > 0) {
                    resolve(locations);
                  } else {
                    resolve(null);
                  };
                },
                function() {
                  resolve(null);
                }
              );
            };
          });
        });
    }
}

class GessQWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {

    public provideWorkspaceSymbols(query: string, token: vscode.CancellationToken):
      Thenable<vscode.SymbolInformation[]> {

      if (query.length === 0) {
        return(null);
      };
      
      var symbols = [];

      var questre = new RegExp("\\b(singleq|multiq|singlegridq|multigridq|openq|textq|numq|group)\\s+(\\w*"+query+"\\w*)\\b", "");
      var blockre = new RegExp("\\b(block)\\b.*\\b(\\w*"+query+"\\w*)\\b", "");
      var screenre = new RegExp("\\b(screen)\\b.*\\b(\\w*"+query+"\\w*)\\b", "");
      var bedingungre = new RegExp("((\\w+\\s+in)\\s*\\b(\\w*"+query+"\\w*)\\b|\\b(\\w*"+query+"\\w*)\\b\\s*(eq|ne|le|ge|lt|gt)\\s+\\w+)\\b", "");
      var assertre = new RegExp("\\b(assert)\\b.*\(\\b(\\w*"+query+"\\w*)\\b\)", "");
      var computere = new RegExp("\\b(compute)\\b.*\\b(\\w*"+query+"\\w*)\\b", "");
 
      const wsfolder = getWorkspaceFolderPath(vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri) || fixDriveCasingInWindows(path.dirname(vscode.window.activeTextEditor.document.fileName));
 
      return new Promise((resolve) => {
        fs.readdirSync(wsfolder).forEach(file => {
          let regEXP = new RegExp("\.(q|inc)$");
          let ok = file.match(regEXP);

          if (ok) {
            vscode.workspace.openTextDocument(wsfolder + "\\" + file).then(
              function(content) {

                let curComment : number = 1;
                let nextComment : number = 0;

                for (var i = 0; i < content.lineCount; i++) {
                  var line = content.lineAt(i);

                  let startComment: number = line.text.search("//");
                  let endComment: number = -1;
                  
                  if (line.text.search("/\\*") > startComment) {
                    endComment = line.text.search("\\*/");
                  };
                  
                  if (line.text.search(query) > -1) {
                    let notErledigt : boolean = true;
                    if (checkComment(line.text.search(questre),startComment,endComment,curComment)) {
                      symbols.push({
                          name: line.text.match(questre)[2],
                          kind: vscode.SymbolKind.Function,
                          location: new vscode.Location(content.uri, line.range),
                          containerName: line.text.match(questre)[1]
                      });
                      notErledigt = false;
                    };
                    if (checkComment(line.text.search(blockre),startComment,endComment,curComment)) {
                      symbols.push({
                          name: line.text.match(blockre)[2],
                          kind: vscode.SymbolKind.Function,
                          location: new vscode.Location(content.uri, line.range),
                          containerName: line.text.match(blockre)[1]
                      });
                      notErledigt = false;
                    };
                    if (checkComment(line.text.search(screenre),startComment,endComment,curComment)) {
                      symbols.push({
                          name: line.text.match(screenre)[2],
                          kind: vscode.SymbolKind.Function,
                          location: new vscode.Location(content.uri, line.range),
                          containerName: line.text.match(screenre)[1]
                      });
                      notErledigt = false;
                    };
                    if (checkComment(line.text.search(assertre),startComment,endComment,curComment)) {
                      symbols.push({
                          name: line.text.match(assertre)[2],
                          kind: vscode.SymbolKind.Operator,
                          location: new vscode.Location(content.uri, line.range),
                          containerName: "assert"
                      });
                      notErledigt = false;
                    };
                    if (checkComment(line.text.search(bedingungre),startComment,endComment,curComment)) {
                      let namestr : string = "";
                      if (line.text.match(bedingungre)[3] == null) {
                        namestr = line.text.match(bedingungre)[4];
                      } else {
                        namestr = line.text.match(bedingungre)[3];
                      };
                      symbols.push({
                          name: namestr,
                          kind: vscode.SymbolKind.Operator,
                          location: new vscode.Location(content.uri, line.range),
                          containerName: "filter"
                      });
                      notErledigt = false;
                    };
                    if (checkComment(line.text.search(computere),startComment,endComment,curComment)) {
                      symbols.push({
                          name: line.text.match(computere)[2],
                          kind: vscode.SymbolKind.Variable,
                          location: new vscode.Location(content.uri, line.range),
                          containerName: line.text.match(computere)[1]
                      });
                      notErledigt = false;
                    };

                  };
                };
                if (symbols.length > 0) {
                  resolve(symbols);
                } else {
                  resolve(null)
                };
              },
              function() {
                resolve(null);
              }
            );
          };
      });
    });
  }
}

