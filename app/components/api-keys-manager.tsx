"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/app/context/auth-context";
import {
  Key,
  Plus,
  Copy,
  Eye,
  EyeClosed,
  RotateCcw,
  Trash2,
  Calendar,
  Activity,
  ShoppingBag,
  Store,
  Zap,
} from "lucide-react";

interface ApiKey {
  id: string;
  key_name: string;
  platform: 'shopify' | 'woocommerce' | 'general';
  key_prefix: string;
  status: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  usage_count: number;
  rate_limit_per_hour: number;
  full_key?: string;
}

interface CreateApiKeyForm {
  keyName: string;
  platform: 'shopify' | 'woocommerce' | 'general';
  expiresAt?: string;
  rateLimitPerHour: number;
}

export default function ApiKeysManager() {
  const { session } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [regenerateKeyId, setRegenerateKeyId] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [newApiKey, setNewApiKey] = useState<string>("");

  const [form, setForm] = useState<CreateApiKeyForm>({
    keyName: "",
    platform: "shopify",
    rateLimitPerHour: 1000,
  });

  const platformIcons = {
    shopify: <Store className="h-4 w-4" />,
    woocommerce: <ShoppingBag className="h-4 w-4" />,
    general: <Zap className="h-4 w-4" />,
  };

  const platformColors = {
    shopify: "bg-green-100 text-green-800 border-green-300",
    woocommerce: "bg-purple-100 text-purple-800 border-purple-300",
    general: "bg-blue-100 text-blue-800 border-blue-300",
  };

  useEffect(() => {
    if (session) {
      fetchApiKeys();
    }
  }, [session]);

  const fetchApiKeys = async () => {
    console.log('fetchApiKeys called - session status:', {
      hasSession: !!session,
      hasAccessToken: !!session?.access_token,
      sessionKeys: session ? Object.keys(session) : [],
      accessTokenPrefix: session?.access_token?.substring(0, 20) + '...'
    });

    if (!session?.access_token) {
      console.log('No session or access token available - session:', session);
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching API keys with token...');
      
      const response = await fetch('/api/keys', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      console.log('Fetch response status:', response.status);
      console.log('Fetch response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        console.log('Fetch success data:', data);
        setApiKeys(data.data || []);
      } else {
        console.error('Fetch failed with status:', response.status, response.statusText);
        let errorData;
        try {
          errorData = await response.json();
          console.error('Fetch error response:', errorData);
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        toast({
          title: "Error",
          description: errorData.error || `Failed to fetch API keys (${response.status})`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Fetch request failed:', error);
      toast({
        title: "Error",
        description: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!session?.access_token) {
      toast({
        title: "Error",
        description: "Please log in to create API keys",
        variant: "destructive",
      });
      return;
    }

    if (!form.keyName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a key name",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Creating API key with data:', form);
      
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(form),
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Success response:', data);
        setNewApiKey(data.data.full_key);
        setCreateDialogOpen(false);
        fetchApiKeys();
        toast({
          title: "Success",
          description: "API key created successfully",
        });
        
        // Reset form
        setForm({
          keyName: "",
          platform: "shopify",
          rateLimitPerHour: 1000,
        });
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        toast({
          title: "Error",
          description: errorData.error || "Failed to create API key",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Request failed:', error);
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "destructive",
      });
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    if (!session?.access_token) {
      toast({
        title: "Error",
        description: "Please log in to manage API keys",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        fetchApiKeys();
        toast({
          title: "Success",
          description: "API key revoked successfully",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.error || "Failed to revoke API key",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to revoke API key",
        variant: "destructive",
      });
    } finally {
      setDeleteKeyId(null);
    }
  };

  const handleRegenerateApiKey = async (keyId: string, platform: string) => {
    if (!session?.access_token) {
      toast({
        title: "Error",
        description: "Please log in to manage API keys",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/keys/${keyId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ platform }),
      });

      if (response.ok) {
        const data = await response.json();
        setNewApiKey(data.data.full_key);
        fetchApiKeys();
        toast({
          title: "Success",
          description: "API key regenerated successfully",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.error || "Failed to regenerate API key",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to regenerate API key",
        variant: "destructive",
      });
    } finally {
      setRegenerateKeyId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  const toggleKeyVisibility = (keyId: string) => {
    const newVisibleKeys = new Set(visibleKeys);
    if (newVisibleKeys.has(keyId)) {
      newVisibleKeys.delete(keyId);
    } else {
      newVisibleKeys.add(keyId);
    }
    setVisibleKeys(newVisibleKeys);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const maskApiKey = (prefix: string) => {
    return `${prefix}${"*".repeat(32)}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-pulse">Loading API keys...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-white border border-gray-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-gray-900 flex items-center">
              <Key className="h-5 w-5 mr-2" />
              Direct Integrations
            </CardTitle>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Generate API Key
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Generate New API Key</DialogTitle>
                  <DialogDescription>
                    Create a new API key for integrating with external platforms.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="keyName">Key Name</Label>
                    <Input
                      id="keyName"
                      placeholder="e.g., Shopify Production Store"
                      value={form.keyName}
                      onChange={(e) => setForm({ ...form, keyName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="platform">Platform</Label>
                    <Select
                      value={form.platform}
                      onValueChange={(value: 'shopify' | 'woocommerce' | 'general') =>
                        setForm({ ...form, platform: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shopify">
                          <div className="flex items-center">
                            <Store className="h-4 w-4 mr-2" />
                            Shopify
                          </div>
                        </SelectItem>
                        <SelectItem value="woocommerce">
                          <div className="flex items-center">
                            <ShoppingBag className="h-4 w-4 mr-2" />
                            WooCommerce
                          </div>
                        </SelectItem>
                        <SelectItem value="general">
                          <div className="flex items-center">
                            <Zap className="h-4 w-4 mr-2" />
                            General API
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="rateLimit">Rate Limit (per hour)</Label>
                    <Input
                      id="rateLimit"
                      type="number"
                      value={form.rateLimitPerHour}
                      onChange={(e) => setForm({ ...form, rateLimitPerHour: parseInt(e.target.value) || 1000 })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateApiKey}>Generate Key</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No API Keys</h3>
              <p className="text-gray-500 mb-4">
                Generate your first API key to start integrating with external platforms.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${platformColors[apiKey.platform]}`}>
                        {platformIcons[apiKey.platform]}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{apiKey.key_name}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {apiKey.platform}
                          </Badge>
                          <Badge 
                            variant={apiKey.status === 'active' ? 'default' : 'secondary'} 
                            className="text-xs"
                          >
                            {apiKey.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleKeyVisibility(apiKey.id)}
                      >
                        {visibleKeys.has(apiKey.id) ? (
                          <EyeClosed className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(
                          visibleKeys.has(apiKey.id) ? apiKey.full_key || maskApiKey(apiKey.key_prefix) : maskApiKey(apiKey.key_prefix)
                        )}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRegenerateKeyId(apiKey.id)}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteKeyId(apiKey.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-gray-100 p-3 rounded font-mono text-sm">
                    {visibleKeys.has(apiKey.id) ? (
                      apiKey.full_key || maskApiKey(apiKey.key_prefix)
                    ) : (
                      maskApiKey(apiKey.key_prefix)
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        Created {formatDate(apiKey.created_at)}
                      </div>
                      <div className="flex items-center">
                        <Activity className="h-4 w-4 mr-1" />
                        {apiKey.usage_count} requests
                      </div>
                    </div>
                    <div>
                      {apiKey.last_used_at ? (
                        `Last used ${formatDate(apiKey.last_used_at)}`
                      ) : (
                        'Never used'
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New API Key Display Dialog */}
      <Dialog open={!!newApiKey} onOpenChange={() => setNewApiKey("")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>API Key Generated</DialogTitle>
            <DialogDescription>
              Your new API key has been generated. Copy it now - you won't be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all">
              {newApiKey}
            </div>
            <Button onClick={() => copyToClipboard(newApiKey)} className="w-full">
              <Copy className="h-4 w-4 mr-2" />
              Copy API Key
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewApiKey("")}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteKeyId} onOpenChange={() => setDeleteKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this API key? This action cannot be undone and will 
              immediately disable access for any integrations using this key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteKeyId && handleDeleteApiKey(deleteKeyId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog open={!!regenerateKeyId} onOpenChange={() => setRegenerateKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to regenerate this API key? The current key will be invalidated 
              immediately and you'll need to update all integrations with the new key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const apiKey = apiKeys.find(k => k.id === regenerateKeyId);
                if (regenerateKeyId && apiKey) {
                  handleRegenerateApiKey(regenerateKeyId, apiKey.platform);
                }
              }}
            >
              Regenerate Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}