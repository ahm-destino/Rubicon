import React from 'react';
import { ChevronDown, CheckCircle2, ShieldCheck, User, Image as ImageIcon } from 'lucide-react';

export const Navbar = ({
  currentRole,
  setCurrentRole,
  currentEvent,
  events,
  onSelectEvent,
  onOpenArchitecture,
  participantSubTab,
  setParticipantSubTab,
}) => {
  const [eventDropdownOpen, setEventDropdownOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo & Event Tag */}
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
            <div
              className="flex items-center space-x-2.5 cursor-pointer select-none shrink-0"
              onClick={() => {
                setCurrentRole('participant');
                setParticipantSubTab('find_my_photos');
              }}
            >
              <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                <div className="w-3.5 h-3.5 bg-white rotate-45" />
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight text-slate-900 font-display hidden sm:inline">
                  RUBICON
                </span>
              </div>
            </div>

            {/* Event Switcher */}
            <div className="relative">
              <button
                id="event-selector-btn"
                type="button"
                onClick={() => setEventDropdownOpen(!eventDropdownOpen)}
                className="flex items-center space-x-2 bg-slate-100/70 hover:bg-slate-100 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs text-slate-800 transition-colors cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-semibold truncate max-w-[110px] sm:max-w-[200px]">
                  {currentEvent.name}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
              </button>

              {eventDropdownOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50">
                  <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Switch Event Catalog
                  </div>
                  {events.map((evt) => (
                    <button
                      key={evt.id}
                      onClick={() => {
                        onSelectEvent(evt);
                        setEventDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                        evt.id === currentEvent.id
                          ? 'bg-indigo-50/70 text-indigo-700 font-bold'
                          : 'text-slate-700'
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-bold text-slate-900 truncate">{evt.name}</div>
                        <div className="text-[11px] text-slate-400">{evt.cohort}</div>
                      </div>
                      {evt.id === currentEvent.id && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Primary Navigation Tabs */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                id="nav-tab-find-photos"
                title="Find My Photos"
                onClick={() => {
                  setCurrentRole('participant');
                  setParticipantSubTab('find_my_photos');
                }}
                className={`flex items-center space-x-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentRole === 'participant' && participantSubTab === 'find_my_photos'
                    ? 'bg-white text-indigo-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Find My Photos</span>
              </button>

              <button
                id="nav-tab-full-gallery"
                title="All Photos"
                onClick={() => {
                  setCurrentRole('participant');
                  setParticipantSubTab('full_gallery');
                }}
                className={`flex items-center space-x-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentRole === 'participant' && participantSubTab === 'full_gallery'
                    ? 'bg-white text-indigo-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">All Photos</span>
              </button>
            </div>

            {/* Single Unified Admin Console Button */}
            <button
              id="nav-admin-portal-btn"
              onClick={() => {
                setCurrentRole(currentRole === 'admin' ? 'participant' : 'admin');
              }}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                currentRole === 'admin'
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm ring-2 ring-indigo-200'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
              title="Access Unified Admin Panel"
            >
              <ShieldCheck className={`w-4 h-4 ${currentRole === 'admin' ? 'text-white' : 'text-indigo-600'}`} />
              <span className="hidden sm:inline">Admin Panel</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
