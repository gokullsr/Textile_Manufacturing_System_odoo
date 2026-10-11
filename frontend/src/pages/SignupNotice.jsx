import React from 'react';
import { Link } from 'react-router-dom';
import { Layers, ShieldAlert, ArrowLeft } from 'lucide-react';

export const SignupNotice = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-teal-500 selection:text-white font-sans">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 mx-auto mb-4">
          <Layers className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Accounts Are By Invitation Only</h1>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Public self-registration is disabled for LoomIQ factory security.
          New manager accounts must be provisioned via a secure, single-use invitation link issued by the factory project owner.
        </p>
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 text-left mb-6 space-y-2">
          <p className="font-semibold text-slate-300">Are you a factory manager?</p>
          <p>Request an onboarding invitation link from your factory owner.</p>
          <p className="font-semibold text-slate-300 pt-1">Are you the factory owner?</p>
          <p>Initial owner provisioning is done via the local secure CLI tool (<code>npm run create-owner</code>).</p>
        </div>
        <Link
          to="/login"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-teal-500/20"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Sign In</span>
        </Link>
      </div>
    </div>
  );
};

export default SignupNotice;
