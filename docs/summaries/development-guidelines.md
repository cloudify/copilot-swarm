# Development Guidelines

## Preventing Ink Text Rendering Errors

When working with the Ink terminal UI framework, it's important to follow these guidelines to prevent text rendering errors:

### 1. Empty Text Elements
❌ **Don't use completely empty Text elements:**
```jsx
<Text></Text>  // This can cause issues
```

✅ **Use a space character instead:**
```jsx
<Text> </Text>  // Use for spacing
```

### 2. Conditional Text Rendering
❌ **Avoid rendering empty strings directly:**
```jsx
{error && <Text color="red">{error}</Text>}  // If error is "", this renders empty string
```

✅ **Check for non-empty strings:**
```jsx
{error && error.trim() && <Text color="red">{error}</Text>}
```

### 3. Array Join Operations
❌ **Array joins can return empty strings:**
```jsx
<Text>{items.join(', ')}</Text>  // Empty array returns ""
```

✅ **Provide fallbacks for empty arrays:**
```jsx
<Text>{items.length > 0 ? items.join(', ') : 'None'}</Text>
```

### 4. Use Linting
Run ESLint to catch potential issues:
```bash
npm run lint:check  # Check for issues
npm run lint        # Auto-fix where possible
```

The project includes ESLint rules specifically configured to catch common Ink rendering issues.

### 5. String Interpolation
❌ **Be careful with template literals that might be empty:**
```jsx
<Text>{`${prefix}${value}`}</Text>  // If both are empty, renders ""
```

✅ **Validate content before rendering:**
```jsx
<Text>{prefix || value ? `${prefix}${value}` : 'No data'}</Text>
```

## Error: "Text string must be rendered inside component"

This error occurs when:
1. An empty string is rendered directly in JSX without being wrapped in a `<Text>` component
2. A variable that evaluates to an empty string is rendered directly
3. Conditional rendering accidentally renders an empty string

Always ensure text content is wrapped in `<Text>` components and non-empty.