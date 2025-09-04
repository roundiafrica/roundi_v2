"use client";

import { useAuth } from "@/app/context/auth-context";

export default function AuthDebug() {
  const { session, user } = useAuth();
  
  if (!session) {
    return (
      <div className="p-4 bg-red-100 border border-red-300 rounded">
        <h3 className="font-bold text-red-800">No Session Found</h3>
        <p className="text-red-700">User is not authenticated</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-blue-100 border border-blue-300 rounded mb-4">
      <h3 className="font-bold text-blue-800 mb-2">Session Debug Info</h3>
      <div className="text-sm space-y-2">
        <div>
          <strong>User ID:</strong> {user?.id || 'Not available'}
        </div>
        <div>
          <strong>User Email:</strong> {user?.email || 'Not available'}
        </div>
        <div>
          <strong>Session Keys:</strong> {Object.keys(session).join(', ')}
        </div>
        <div>
          <strong>Has access_token:</strong> {session.access_token ? 'Yes' : 'No'}
        </div>
        {session.access_token && (
          <div>
            <strong>Token Preview:</strong> {session.access_token.substring(0, 30)}...
          </div>
        )}
        <div>
          <strong>Token Type:</strong> {session.token_type || 'Not available'}
        </div>
        <div>
          <strong>Expires At:</strong> {session.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'Not available'}
        </div>
      </div>
      
      <details className="mt-4">
        <summary className="cursor-pointer font-semibold">Full Session Object</summary>
        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
          {JSON.stringify(session, null, 2)}
        </pre>
      </details>
    </div>
  );
}