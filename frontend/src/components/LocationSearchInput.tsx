import { useState, useEffect, useRef } from "react";
import { MapPin, Loader2 } from "lucide-react";

interface LocationSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectLocation: (name: string, lat: number, lng: number) => void;
  placeholder?: string;
  className?: string;
}

export default function LocationSearchInput({
  value,
  onChange,
  onSelectLocation,
  placeholder = "Search location...",
  className = "",
}: LocationSearchInputProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close dropdown if clicked outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!value || value.length < 3) {
      setSuggestions([]);
      return;
    }

    // Debounce the API call
    const delayDebounceFn = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            value
          )}&limit=5`
        );
        const data = await response.json();
        if (Array.isArray(data)) {
          setSuggestions(data);
          if (data.length > 0) {
            setShowDropdown(true);
          }
        }
      } catch (error) {
        console.error("Error fetching location data:", error);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [value]);

  return (
    <div className={`relative flex flex-col gap-1.5 ${className}`} ref={dropdownRef}>
      <div className="relative">
        <MapPin size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ac2d00]" />
        <input
          className="w-full h-12 pl-12 pr-10 bg-white border border-[#e2bfb5] focus:border-[#ac2d00] focus:ring-1 focus:ring-[#ac2d00] rounded-lg text-[16px] outline-none transition-all"
          placeholder={placeholder}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
        />
        {isLoading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 size={18} className="animate-spin text-[#ac2d00]" />
          </div>
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e2bfb5] rounded-lg shadow-lg z-50 overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              type="button"
              className="w-full text-left px-4 py-3 hover:bg-[#ffe9e4] border-b border-[#e2bfb5] last:border-b-0 transition-colors"
              onClick={() => {
                const parts = suggestion.display_name.split(", ");
                // Pick the first few parts for a cleaner display name
                const shortName = parts.slice(0, 3).join(", ");
                onChange(shortName);
                onSelectLocation(shortName, parseFloat(suggestion.lat), parseFloat(suggestion.lon));
                setShowDropdown(false);
              }}
            >
              <div className="flex flex-col">
                <span className="font-semibold text-[#261814] text-[14px]">
                  {suggestion.display_name.split(",")[0]}
                </span>
                <span className="text-[#5a413a] text-[12px] truncate">
                  {suggestion.display_name}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
