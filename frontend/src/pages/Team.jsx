import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Trash2,
  Power,
  RefreshCw,
  AlertCircle,
  KeyRound,
} from 'lucide-react';

export const Team = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
    isDestructive: false,
  });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [usersRes, invitesRes] = await Promise.all([
        apiClient.get('/users'),
        apiClient.get('/invitations'),
      ]);
      setUsers(usersRes.users || []);
      setInvitations(invitesRes.invitations || []);
    } catch (err) {
      setError(err.message || 'Failed to load team data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    setError(null);

    try {
      const res = await apiClient.post('/invitations', { email: inviteEmail.trim() });
      const fullLink = `${window.location.origin}${res.inviteLink}`;
      setInviteResult({
        ...res,
        fullLink,
      });
      setInviteEmail('');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to generate invitation link.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyLink = () => {
    if (inviteResult?.fullLink) {
      navigator.clipboard.writeText(inviteResult.fullLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleToggleUserStatus = (targetUser) => {
    const isDeactivating = targetUser.isActive;
    setConfirmModal({
      open: true,
      title: isDeactivating ? 'Deactivate User Account' : 'Reactivate User Account',
      message: isDeactivating
        ? `Are you sure you want to deactivate ${targetUser.name} (${targetUser.email})? All their active sessions will be terminated immediately.`
        : `Reactivate access for ${targetUser.name} (${targetUser.email})?`,
      isDestructive: isDeactivating,
      onConfirm: async () => {
        try {
          await apiClient.patch(`/users/${targetUser.id}`, { isActive: !isDeactivating });
          setActionSuccess(`User ${targetUser.email} ${isDeactivating ? 'deactivated' : 'reactivated'} successfully.`);
          setTimeout(() => setActionSuccess(null), 4000);
          fetchData();
        } catch (err) {
          setError(err.message || 'Failed to update user status.');
        } finally {
          setConfirmModal({ open: false });
        }
      },
    });
  };

  const handleRevokeInvite = (invitation) => {
    setConfirmModal({
      open: true,
      title: 'Revoke Invitation',
      message: `Revoke the pending invitation for ${invitation.email}? This link will become permanently invalid.`,
      isDestructive: true,
      onConfirm: async () => {
        try {
          await apiClient.delete(`/invitations/${invitation.id}`);
          setActionSuccess(`Invitation for ${invitation.email} revoked.`);
          setTimeout(() => setActionSuccess(null), 4000);
          fetchData();
        } catch (err) {
          setError(err.message || 'Failed to revoke invitation.');
        } finally {
          setConfirmModal({ open: false });
        }
      },
    });
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              Owner Administration
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">Team & Permissions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage factory operators, assign roles, and issue single-use onboarding invitation links.
          </p>
        </div>

        <button
          onClick={() => {
            setInviteResult(null);
            setIsInviteModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Manager</span>
        </button>
      </div>

      {/* Action Alerts */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Users Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-600" />
            <h2 className="font-bold text-slate-900 text-base">Active Team Members ({users.length})</h2>
          </div>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            title="Refresh team members"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-6">Member</th>
                <th className="py-3.5 px-6">Role</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Last Login</th>
                <th className="py-3.5 px-6">Joined</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isSelf = currentUser?.id === u.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-xs border border-slate-200">
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span>{u.name}</span>
                            {isSelf && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-mono">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          u.role === 'owner'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {u.role === 'owner' ? <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> : <Shield className="w-3.5 h-3.5 text-slate-500" />}
                        <span className="capitalize">{u.role}</span>
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-500 font-mono">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never logged in'}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {!isSelf && u.role !== 'owner' ? (
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                            u.isActive
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>{u.isActive ? 'Deactivate' : 'Reactivate'}</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Protected</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invitations Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-slate-600" />
            <h2 className="font-bold text-slate-900 text-base">Onboarding Invitations ({invitations.length})</h2>
          </div>
        </div>

        {invitations.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No pending or past invitations. Use "Invite Manager" above to onboard team members.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">Invitee Email</th>
                  <th className="py-3.5 px-6">Role</th>
                  <th className="py-3.5 px-6">Created</th>
                  <th className="py-3.5 px-6">Expires In</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invitations.map((inv) => {
                  const isUsed = !!inv.usedAt;
                  const isRevoked = !!inv.revokedAt;
                  const isExpired = inv.isExpired && !isUsed && !isRevoked;
                  const isPending = !isUsed && !isRevoked && !inv.isExpired;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6 font-mono text-xs font-semibold text-slate-800">
                        {inv.email}
                      </td>
                      <td className="py-4 px-6 text-xs capitalize text-slate-600 font-medium">
                        {inv.role}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-500">
                        {new Date(inv.createdAt).toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-500">
                        {isPending ? new Date(inv.expiresAt).toLocaleString() : '—'}
                      </td>
                      <td className="py-4 px-6">
                        {isUsed && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
                          </span>
                        )}
                        {isRevoked && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3.5 h-3.5" /> Revoked
                          </span>
                        )}
                        {isExpired && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <Clock className="w-3.5 h-3.5" /> Expired
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5" /> Pending Link
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {isPending && (
                          <button
                            onClick={() => handleRevokeInvite(inv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Revoke</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Invite Plant Manager</h3>
            <p className="text-xs text-slate-500 mb-5">
              Generates a secure, single-use onboarding link valid for 48 hours. Only the SHA-256 hash is stored in the database.
            </p>

            {!inviteResult ? (
              <form onSubmit={handleCreateInvite} className="space-y-4">
                <div>
                  <label htmlFor="inviteEmail" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Manager Email Address
                  </label>
                  <input
                    id="inviteEmail"
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="manager@factory.internal"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isInviting && <RefreshCw className="w-4 h-4 animate-spin" />}
                    <span>Generate Link</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs">
                  <p className="font-bold flex items-center gap-1.5 mb-1 text-teal-800">
                    <CheckCircle2 className="w-4 h-4" /> Invitation Link Generated Once
                  </p>
                  <p className="text-slate-600">
                    Copy and transmit this link directly to the manager. For application security, this raw link will <strong>never be shown again</strong>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Single-Use Invite Link
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={inviteResult.fullLink}
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors flex-shrink-0 cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsInviteModalOpen(false);
                      setInviteResult(null);
                    }}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-sm rounded-xl transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
              confirmModal.isDestructive ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-700'
            }`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">{confirmModal.title}</h3>
            <p className="text-xs text-slate-600 mb-6">{confirmModal.message}</p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal({ open: false })}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors cursor-pointer ${
                  confirmModal.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-teal-600 hover:bg-teal-700'
                }`}
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Team;
