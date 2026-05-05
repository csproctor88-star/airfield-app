// Ambient declaration: @types/react-dom is not installed in this repo.
// Declare just the symbols from react-dom/server that we use.
declare module 'react-dom/server' {
  function renderToStaticMarkup(element: import('react').ReactElement): string
  function renderToString(element: import('react').ReactElement): string
}
