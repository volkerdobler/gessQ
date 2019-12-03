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

class clComment {
  oneLine: number;       // position of // in line
  start: number;         // position of /* in line
  end: number;           // position of */ in line
  status: number;        // 1 = not in Comment; -1 = in Comment
  changing: number;      // 1 ending comment in line; -1 starting comment in line; 0 no comment-char in line
  
  constructor (oneC: number = -1, startC: number = -1, endC: number = -1) {
    this.oneLine = oneC;
    this.start = startC;
    this.end = endC;
    this.status = 1;
    this.changing = 0;
  };
  
  checkCommentsInLine(oneC: number, startC: number, endC: number) {
    this.oneLine = oneC;
    this.start = startC;
    this.end = endC;
  };
  
  checkIfInComment(command: number) : boolean {
    
    if (this.status === -1 && this.end === -1) {        // wir befinden uns in einem Kommentarbereich
      return false;
    };
    
    if (command > -1) {                      // ist der reguläre Ausdruck vorhanden
      if (this.start > -1) {                 // es wird ein Kommentar eröffnet
        if (this.end > -1) {                 // es wird ein Kommentar geschlossen
          if (this.start > this.end) {
            if (command < this.start && command > this.end && (this.oneLine === -1 || (this.oneLine > -1 && command < this.oneLine))) {
              return true
            } else {
              return false;
            };
          } else {
            if ((command < this.start || command > this.end) && (this.oneLine === -1 || (this.oneLine > -1 && command < this.oneLine))) {  // entweder vor oder nach dem Kommentar
              return true;
            } else {
              return false;
            };
          };
        } else {                       // nur Kommentar eröffnet
          if (command < this.start && (this.oneLine === -1 || (this.oneLine > -1 && command < this.oneLine))) {
            return true;
          } else {
            return false;
          }
        }
      } else {                         // kein Kommentar wird eröffnet
        if (this.end > -1) {         // Kommentar wird geschlossen
          if (this.oneLine > this.end) {
            if (command > this.end && command < this.oneLine) {
              return true
            } else {
              return false;
            };
          } else {
            if (command > this.end) {
              return true;
            } else {
              return false;
            };
          }
        } else {                       // kein Kommentar wird geschlossen
          if (this.oneLine > -1) {
            if (command < this.oneLine) {
              return true;
            } else {
              return false;
            };
          } else {
            if (this.status < 0) {     // wir befinden uns bereits in einem Kommentar
              return false;
            } else {
              return true;               // nicht in einem Kommentar
            }
          }
        }
      }
    } else {
      return false;  // es gibt keinen passenden Text in der Zeile, deshalb false zurückgeben
    };
  };
  
  switchCommentStatus() {
    if (this.start > -1 && ((this.oneLine === -1) || (this.oneLine > -1 && this.start < this.oneLine))) {
      this.status = -1;
    };
    if (this.end > -1 && ((this.oneLine === -1) || (this.oneLine > -1 && this.end < this.oneLine))) {
      this.status = 1;
    }
  };
};


class GessQDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    public provideDocumentSymbols(document: vscode.TextDocument,
            token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[]> {
        return new Promise((resolve) => {

            var symbols = [];
            
            var questreg = new RegExp(/^\b(singleq|multiq|singlegridq|multigridq|openq|textq|numq|group|compute)\s+([\w\.]+)/i);
            var blockreg = new RegExp(/^\b(block|screen)\s+([\w\.]+)/i);
            var cABreg = new RegExp(/\b(load|set)\b\s*\(\s*([^=\s]+)\s*=/i);

            let comments = new clComment();
            
            for (var i = 0; i < document.lineCount; i++) {
                var line = document.lineAt(i);

                if (line.text.length === 0) {
                  continue;
                };
                
                comments.checkCommentsInLine(line.text.search("//"),line.text.search("/\\*"),line.text.search("\\*/"));
                
                if (comments.checkIfInComment(line.text.search(questreg))) {
                    symbols.push({
                        name: line.text.match(questreg)[2],
                        kind: vscode.SymbolKind.Variable,
                        location: new vscode.Location(document.uri, line.range),
                        containerName: line.text.match(questreg)[1].toLocaleLowerCase()
                    })
                };
                if (comments.checkIfInComment(line.text.search(blockreg))) {
                    symbols.push({
                        name: line.text.match(blockreg)[2],
                        kind: vscode.SymbolKind.Method,
                        location: new vscode.Location(document.uri, line.range),
                        containerName: line.text.match(blockreg)[1].toLocaleLowerCase()
                    })
                };
                if (comments.checkIfInComment(line.text.search(cABreg))) {
                    symbols.push({
                        name: line.text.match(cABreg)[2],
                        kind: vscode.SymbolKind.Variable,
                        location: new vscode.Location(document.uri, line.range),
                        containerName: line.text.match(cABreg)[1].toLocaleLowerCase()
                    })
                };
                comments.switchCommentStatus();
            };
            
            resolve(symbols);
        });
    }
}

function getDefLocationInDocument(filename: string, word: string) {
  
  let questre = new RegExp("\\b(singleq|multiq|singlegridq|multigridq|openq|textq|numq|group|opennumformat)\\s+("+word+")\\b", "i");
  let blockre = new RegExp("\\b(block|screen)\\s+("+word+")\\b\\s*=", "i");
  
  let locPosition: vscode.Location = null;

  return vscode.workspace.openTextDocument(filename).then((content) => {
    
    let comments = new clComment();
    
    for (let i = 0; i < content.lineCount; i++) {
      let line = content.lineAt(i);
      
      comments.checkCommentsInLine(line.text.search("//"),line.text.search("/\\*"),line.text.search("\\*/"));
      
      if (comments.checkIfInComment(line.text.search(questre)) || 
          comments.checkIfInComment(line.text.search(blockre))) {
        locPosition = new vscode.Location(content.uri, line.range);
      };
      comments.switchCommentStatus();
    };
    return(locPosition);
  });
};

class GessQDefinitionProvider implements vscode.DefinitionProvider {
  public provideDefinition(document: vscode.TextDocument, position: vscode.Position, 
          token: vscode.CancellationToken): Thenable<vscode.Location> {
    const adjustedPos = adjustWordPosition(document, position);
    
    return new Promise((resolve) => {
      
      if (!adjustedPos[0]) {
        return Promise.resolve(null);
      }
      const word = adjustedPos[1];

      let wsfolder = getWorkspaceFolderPath(document.uri) || fixDriveCasingInWindows(path.dirname(document.fileName));
      let fileNames: string[] = [];
      
      fs.readdirSync(wsfolder).forEach(file => {
        let regEXP = new RegExp("\\.q$");
        let ok = file.match(regEXP);
        if (ok) {
          fileNames.push(wsfolder + "\\" + file);
        };
      });
      let locations = fileNames.map(file => getDefLocationInDocument(file,word) );
      Promise.all(locations).then(
        function(content) {
          let locPos: vscode.Location = null;
          
          content.forEach(loc => {
            if (loc != null) {
              locPos = loc;
            };
          });

          return(locPos);
        }).then(result => {
          resolve(result);
        });
    });
  };
};

function getAllLocationInDocument(filename: string, word: string) {
  
  let questre = new RegExp("\\b(singleq|multiq|singlegridq|multigridq|openq|textq|numq|group|opennumformat)\\s+("+word+")\\b", "i");
  let blockre = new RegExp("\\b(block|screen)\\s+("+word+")\\b[^=]*=|\\b(block)\\b[^=]*=\\s*\\(.*\\b("+word+")\\b", "i");
  let screenre = new RegExp("\\b(screen)\\b[^=]*=\\s*\\b(column|row)?\\b\\s*\\(.*\\b("+word+")\\b", "i");
  let wordre = new RegExp("(in\\s*\\b"+word+"\\b|\\b"+word+"\\b\\s*(eq|ne|le|ge|lt|gt))\\b", "i");
  let assertre = new RegExp("\\bassert\\s+\\(.*\\b("+word+")\\b", "i");
  let computere = new RegExp("\\bcompute\\b\\s*.+\\b("+word+")\\b", "i");
  let cABre = new RegExp("\\b(load|set)\\b\\s*\\(\\s*("+word+")\\s*=","i");
  
  let locArray: vscode.Location[] = [];

  return vscode.workspace.openTextDocument(filename).then((content) => {
  
    let comments = new clComment();
    
    for (let i = 0; i < content.lineCount; i++) {
      let line = content.lineAt(i);
      comments.checkCommentsInLine(line.text.search("//"),line.text.search("/\\*"),line.text.search("\\*/"));
      
      if (comments.checkIfInComment(line.text.search(questre)) || 
          comments.checkIfInComment(line.text.search(blockre)) || 
          comments.checkIfInComment(line.text.search(screenre)) ||
          comments.checkIfInComment(line.text.search(wordre)) || 
          comments.checkIfInComment(line.text.search(assertre)) || 
          comments.checkIfInComment(line.text.search(computere)) || 
          comments.checkIfInComment(line.text.search(cABre))) {
        locArray.push(new vscode.Location(content.uri, line.range));
      };
      comments.switchCommentStatus();
    };
    return(locArray);
  });
};

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
        
        let loclist: vscode.Location[] = [];
        
        let wsfolder = getWorkspaceFolderPath(document.uri) || fixDriveCasingInWindows(path.dirname(document.fileName));
        let fileNames: string[] = [];
        
        fs.readdirSync(wsfolder).forEach(file => {
          let regEXP = new RegExp("\\.q$");
          let ok = file.match(regEXP);
          if (ok) {
            fileNames.push(wsfolder + "\\" + file);
          };
        });
        let locations = fileNames.map(file => getAllLocationInDocument(file,word) );
        Promise.all(locations).then(
          function(content) {
            content.forEach(loc => {
              if (loc != null && loc[0] != null) {
                loc.forEach(arr => {
                  loclist.push(arr);
                })
              };
            });
            return(loclist);
          }).then(result => {
            resolve(result);
          }).catch(e => {
            resolve(null);
          });
    })
  };
};

class GessQWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {

    public provideWorkspaceSymbols(query: string, token: vscode.CancellationToken):
      Thenable<vscode.SymbolInformation[]> {

      if (query.length === 0) {
        return(null);
      };
      
      var symbols = [];

      var questre = new RegExp("\\b(singleq|multiq|singlegridq|multigridq|openq|textq|numq|group|opennumformat)\\s+(\\w*"+query+"\\w*)\\b", "i");
      var blockre = new RegExp("\\b(block)\\b.*\\b(\\w*"+query+"\\w*)\\b", "i");
      var screenre = new RegExp("\\b(screen)\\b.*\\b(\\w*"+query+"\\w*)\\b", "i");
      var bedingungre = new RegExp("((\\w+\\s+in)\\s*\\b(\\w*"+query+"\\w*)\\b|\\b(\\w*"+query+"\\w*)\\b\\s*(eq|ne|le|ge|lt|gt)\\s+\\w+)\\b", "i");
      var assertre = new RegExp("\\b(assert)\\b.*\(\\b(\\w*"+query+"\\w*)\\b\)", "i");
      var computere = new RegExp("\\b(compute)\\b.*\\b(\\w*"+query+"\\w*)\\b", "i");
 
      const wsfolder = getWorkspaceFolderPath(vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri) || fixDriveCasingInWindows(path.dirname(vscode.window.activeTextEditor.document.fileName));
 
      return new Promise((resolve) => {
        fs.readdirSync(wsfolder).forEach(file => {
          let regEXP = new RegExp("\.(q|inc)$");
          let ok = file.match(regEXP);

          if (ok) {
            vscode.workspace.openTextDocument(wsfolder + "\\" + file).then(
              function(content) {

                let comments = new clComment();
                
                for (var i = 0; i < content.lineCount; i++) {
                  var line = content.lineAt(i);

                  comments.checkCommentsInLine(line.text.search("//"),line.text.search("/\\*"),line.text.search("\\*/"));

                  if (line.text.search(query) > -1) {
                    if (comments.checkIfInComment(line.text.search(questre))) {
                      symbols.push({
                          name: line.text.match(questre)[2],
                          kind: vscode.SymbolKind.Function,
                          location: new vscode.Location(content.uri, line.range),
                          containerName: line.text.match(questre)[1]
                      });
                    };
                    if (comments.checkIfInComment(line.text.search(blockre))) {
                      symbols.push({
                          name: line.text.match(blockre)[2],
                          kind: vscode.SymbolKind.Function,
                          location: new vscode.Location(content.uri, line.range),
                          containerName: line.text.match(blockre)[1]
                      });
                    };
                    if (comments.checkIfInComment(line.text.search(screenre))) {
                      symbols.push({
                          name: line.text.match(screenre)[2],
                          kind: vscode.SymbolKind.Function,
                          location: new vscode.Location(content.uri, line.range),
                          containerName: line.text.match(screenre)[1]
                      });
                    };
                    if (comments.checkIfInComment(line.text.search(assertre))) {
                      symbols.push({
                          name: line.text.match(assertre)[2],
                          kind: vscode.SymbolKind.Operator,
                          location: new vscode.Location(content.uri, line.range),
                          containerName: "assert"
                      });
                    };
                    if (comments.checkIfInComment(line.text.search(bedingungre))) {
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
                    };
                    if (comments.checkIfInComment(line.text.search(computere))) {
                      symbols.push({
                          name: line.text.match(computere)[2],
                          kind: vscode.SymbolKind.Variable,
                          location: new vscode.Location(content.uri, line.range),
                          containerName: line.text.match(computere)[1]
                      });
                    };
                  };
                };
                return(symbols);
              }
            ).then(result => {
              resolve(result);
            })
          };
      });
    });
  }
}

