import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-4xl font-medium text-foreground">404</h1>
      <p className="text-sm text-muted-foreground mt-2">Page not found</p>
      <Link to="/" className="mt-4 text-sm font-medium" style={{ color: '#B8906C' }}>
        Go home →
      </Link>
    </div>
  );
}
