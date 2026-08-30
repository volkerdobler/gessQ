import { lensApplies } from '../providers/codeLensProvider';
import type { IndexedSymbol } from '../core/symbolIndex';

const sym = (
	category: IndexedSymbol['category'],
	detail: string,
): IndexedSymbol => ({ category, detail }) as IndexedSymbol;

describe('lensApplies', () => {
	const q = sym('question', 'singleq');
	const onf = sym('definition', 'opennumformat');
	const compute = sym('definition', 'compute');
	const block = sym('block', 'block');
	const macro = sym('macro', 'macro');
	const quota = sym('quota', 'quotavar');
	const arr = sym('array', 'array');
	const action = sym('action', 'set');

	test('questions: only question definitions', () => {
		expect(lensApplies('questions', q)).toBe(true);
		for (const s of [onf, compute, block, macro, quota, arr, action]) {
			expect(lensApplies('questions', s)).toBe(false);
		}
	});

	test('reusable: questions + opennumformat / block / macro / quotavar', () => {
		for (const s of [q, onf, block, macro, quota]) {
			expect(lensApplies('reusable', s)).toBe(true);
		}
		for (const s of [compute, arr, action]) {
			expect(lensApplies('reusable', s)).toBe(false);
		}
	});

	test('all: everything except set/load assignment targets', () => {
		for (const s of [q, onf, compute, block, macro, quota, arr]) {
			expect(lensApplies('all', s)).toBe(true);
		}
		expect(lensApplies('all', action)).toBe(false);
	});
});
