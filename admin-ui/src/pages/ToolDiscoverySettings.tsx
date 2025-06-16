import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, RefreshCw, HelpCircle, Settings } from 'lucide-react';
import { MCPBridgeService } from '../services/mcpBridge';
import type { ToolDiscoveryRule } from '../types';

const mcpBridge = new MCPBridgeService();

export default function ToolDiscoverySettings() {
  const [rules, setRules] = useState<ToolDiscoveryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const discoveryRules = await mcpBridge.getToolDiscoveryRules();
      setRules(discoveryRules);
    } catch (error) {
      console.error('Error fetching tool discovery rules:', error);
      setMessage({ type: 'error', text: 'Failed to load tool discovery rules' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await mcpBridge.updateToolDiscoveryRules(rules);
      setMessage({ type: 'success', text: 'Tool discovery rules saved successfully. Changes applied immediately.' });
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Error saving tool discovery rules:', error);
      setMessage({ type: 'error', text: 'Failed to save tool discovery rules' });
    } finally {
      setSaving(false);
    }
  };

  const addRule = () => {
    setRules([...rules, { serverPattern: '*', toolPattern: '*', exclude: false }]);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, field: keyof ToolDiscoveryRule, value: string | boolean) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], [field]: value };
    setRules(newRules);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading tool discovery settings...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Tool Discovery Settings</h1>
        <p className="text-gray-600">
          Configure automatic tool discovery rules to control which tools are automatically registered from MCP servers.
        </p>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <HelpCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <h3 className="font-medium mb-2">How Tool Discovery Works</h3>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>Server Pattern:</strong> Matches server IDs (e.g., "git", "github", "*" for all)</li>
              <li><strong>Tool Pattern:</strong> Matches tool names (e.g., "git_*", "search", "*" for all)</li>
              <li><strong>Exclude:</strong> When checked, prevents matching tools from being registered</li>
              <li><strong>Wildcards:</strong> Use "*" for any string, "?" for single character</li>
              <li><strong>Order matters:</strong> Rules are applied in order, first match wins</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Rules Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Discovery Rules</h2>
            <div className="flex space-x-2">
              <button
                onClick={addRule}
                className="btn btn-secondary flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary flex items-center"
              >
                {saving ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {saving ? 'Saving...' : 'Save Rules'}
              </button>
            </div>
          </div>

          {rules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Settings className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg mb-2">No discovery rules configured</p>
              <p className="text-sm">Add rules to control automatic tool discovery</p>
              <button
                onClick={addRule}
                className="mt-4 btn btn-primary"
              >
                Add your first rule
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {rules.map((rule, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Server Pattern */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Server Pattern
                      </label>
                      <input
                        type="text"
                        value={rule.serverPattern}
                        onChange={(e) => updateRule(index, 'serverPattern', e.target.value)}
                        placeholder="e.g., *, git, github"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* Tool Pattern */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tool Pattern
                      </label>
                      <input
                        type="text"
                        value={rule.toolPattern}
                        onChange={(e) => updateRule(index, 'toolPattern', e.target.value)}
                        placeholder="e.g., *, git_*, search"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* Exclude Checkbox */}
                    <div className="flex items-center">
                      <div className="mt-6">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={rule.exclude}
                            onChange={(e) => updateRule(index, 'exclude', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                          />
                          <span className="ml-2 text-sm text-gray-700">Exclude</span>
                        </label>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => removeRule(index)}
                        className="btn btn-danger flex items-center"
                        title="Remove rule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Rule Preview */}
                  <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded p-2">
                    <span className="font-medium">
                      {rule.exclude ? 'Exclude' : 'Include'} tools matching:
                    </span>{' '}
                    Server "{rule.serverPattern}" → Tool "{rule.toolPattern}"
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Examples Section */}
      <div className="mt-6 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Example Rules</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="bg-white rounded p-3 border">
              <div className="font-medium text-gray-900">Include all tools</div>
              <div className="text-gray-600">Server: "*", Tool: "*", Exclude: false</div>
            </div>
            <div className="bg-white rounded p-3 border">
              <div className="font-medium text-gray-900">Only Git tools</div>
              <div className="text-gray-600">Server: "git", Tool: "*", Exclude: false</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="bg-white rounded p-3 border">
              <div className="font-medium text-gray-900">Exclude debug tools</div>
              <div className="text-gray-600">Server: "*", Tool: "*debug*", Exclude: true</div>
            </div>
            <div className="bg-white rounded p-3 border">
              <div className="font-medium text-gray-900">Only search tools</div>
              <div className="text-gray-600">Server: "*", Tool: "*search*", Exclude: false</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
