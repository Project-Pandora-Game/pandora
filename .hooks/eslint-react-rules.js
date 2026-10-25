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
			MemberExpression(node) {
				const source = node.object;
				if (source.type !== 'MemberExpression' || source.object.type !== 'ThisExpression' || source.property.type !== 'Identifier')
					return;
				if (!['props', 'state', 'context'].includes(source.property.name) || node.optional)
					return;
				if (node.parent.type === 'AssignmentExpression' && node.parent.left === node)
					return;
				let parent = node.parent;
				while (parent.type !== 'ClassDeclaration' && parent.type !== 'ClassExpression' && parent.parent != null) {
					parent = parent.parent;
				}
				if (parent.type !== 'ClassDeclaration' && parent.type !== 'ClassExpression')
					return;
				const base = parent.superClass;
				const baseName = base?.type === 'Identifier' ? base.name : base?.type === 'MemberExpression' && base.property.type === 'Identifier' ? base.property.name : null;
				if (baseName !== 'Component' && baseName !== 'PureComponent')
					return;
				context.report({ node, message: `Use destructuring assignment for component ${source.property.name}.` });
			},
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
