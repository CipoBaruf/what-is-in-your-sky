/**
 * R188 (FR-WIDE-11, D-1101): the `facts` chunk's entry. Rollup names a dynamic import's chunk after the module it
 * imports, so the group is reached through this file and ships as `facts-*.js`.
 */
export { default } from './FactsGroup';
