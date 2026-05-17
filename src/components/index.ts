// Barrel file re-exporting public components and helpers from the components folder.
export { GessQCompletionProvider } from './completionComponent';
export { GessQHoverProvider } from './hoverProvider';
export { GessQSignatureProvider } from './signatureProvider';
export {
	getScopeAt,
	getCachedScope,
	clearScopeCache,
	isNotInCommentAt,
	isCommentAt,
	isStringAt,
	Scope,
	ScopeEnum,
	cacheDebug,
} from './scopeComponent';
