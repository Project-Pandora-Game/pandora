//@ts-check
import { merge } from '@eslint-react/kit';

/**
 * Preserve react/destructuring-assignment for function component props.
 * Based on ESLint React's documented migration example.
 * @returns {import('@eslint-react/kit').RuleFunction}
 */
export function requireDestructuredProps() {
	return (context, { collect }) => {
		const { query, visitor } = collect.components(context);
		return merge(visitor, {
			'Program:exit'(program) {
				for (const { name, node } of query.all(program)) {
					// JSX-producing helpers and render callbacks also appear in the collector.
					// Only React component functions receive a props object as their first argument.
					if (name == null || !/^[_$]*[A-Z]/.test(name) || node.params.length > 2)
						continue;
					if (node.returnType != null && !/\bReact(Element|Node)\b(?!\[)/.test(context.sourceCode.getText(node.returnType)))
						continue;
					const [props] = node.params;
					if (props?.type !== 'Identifier')
						continue;
					const variable = context.sourceCode.getScope(node).variables.find((entry) => entry.name === props.name);
					for (const reference of variable?.references ?? []) {
						if (reference.identifier.parent.type !== 'MemberExpression' || reference.identifier.parent.optional)
							continue;
						context.report({
							message: 'Use destructuring assignment for component props.',
							node: reference.identifier.parent,
						});
					}
				}
			},
		});
	};
}
