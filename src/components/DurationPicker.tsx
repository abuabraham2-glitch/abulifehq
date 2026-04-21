import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

interface Props {
  value: number;
  disabled?: boolean;
  onChange: (newMinutes: number) => void;
}

const PRESETS = [15, 30, 45, 60, 90];

export function DurationPicker({ value, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customVal, setCustomVal] = useState(String(value));

  const pick = (m: number) => {
    setOpen(false);
    setCustomMode(false);
    if (m !== value) onChange(m);
  };

  const saveCustom = () => {
    const n = Math.max(1, Math.min(480, Number(customVal) || value));
    pick(n);
  };

  if (disabled) {
    return <span className="text-[12px] text-muted-foreground flex-shrink-0">{value || 0}m</span>;
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setCustomMode(false);
        if (o) setCustomVal(String(value));
      }}
    >
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="text-[12px] text-muted-foreground flex-shrink-0 px-1.5 py-0.5 rounded hover:bg-[#FFF8F0]"
        >
          {value || 0}m
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto p-2 rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {!customMode ? (
          <div className="flex flex-wrap gap-1.5 max-w-[260px]">
            {PRESETS.map((m) => (
              <button
                key={m}
                onClick={() => pick(m)}
                className="px-2.5 py-1 rounded-lg text-[12px] font-medium border min-h-[32px]"
                style={{
                  borderColor: value === m ? '#B8906C' : 'hsl(var(--border))',
                  backgroundColor: value === m ? '#B8906C' : 'transparent',
                  color: value === m ? '#fff' : 'hsl(var(--foreground))',
                }}
              >
                {m}m
              </button>
            ))}
            <button
              onClick={() => setCustomMode(true)}
              className="px-2.5 py-1 rounded-lg text-[12px] font-medium border min-h-[32px]"
              style={{ borderColor: 'hsl(var(--border))', color: '#5C3D1E' }}
            >
              Custom
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={1}
              max={480}
              value={customVal}
              onChange={(e) => setCustomVal(e.target.value)}
              autoFocus
              className="w-20 h-8 text-center text-[13px]"
            />
            <span className="text-[12px] text-muted-foreground">m</span>
            <button
              onClick={saveCustom}
              className="px-2.5 h-8 rounded-lg text-[12px] font-medium text-white"
              style={{ backgroundColor: '#B8906C' }}
            >
              Save
            </button>
            <button
              onClick={() => setCustomMode(false)}
              className="px-2 h-8 rounded-lg text-[12px] text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
