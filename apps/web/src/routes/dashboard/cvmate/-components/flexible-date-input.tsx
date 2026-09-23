import { t } from "@lingui/core/macro";
import { CalendarBlankIcon } from "@phosphor-icons/react";
import { useRef } from "react";
import { Button } from "@reactive-resume/ui/components/button";
import { Input } from "@reactive-resume/ui/components/input";

type FlexibleDateInputProps = {
	ariaLabel: string;
	placeholder: string;
	value: string;
	disabled?: boolean;
	className?: string;
	onChange: (value: string) => void;
};

export function FlexibleDateInput({
	ariaLabel,
	placeholder,
	value,
	disabled = false,
	className,
	onChange,
}: FlexibleDateInputProps) {
	const pickerRef = useRef<HTMLInputElement>(null);
	const pickerValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";

	const openPicker = () => {
		const picker = pickerRef.current;
		if (!picker || disabled) return;

		try {
			picker.showPicker();
		} catch {
			picker.click();
		}
	};

	return (
		<div className={`flex min-w-0 items-center gap-2 ${className ?? ""}`.trim()}>
			<Input
				className="min-w-0 flex-1"
				aria-label={ariaLabel}
				inputMode="numeric"
				maxLength={10}
				placeholder={placeholder}
				value={value}
				disabled={disabled}
				onChange={(event) => onChange(event.target.value)}
			/>
			<Button
				type="button"
				size="icon"
				variant="outline"
				className="shrink-0"
				aria-label={t`Choose full date from calendar`}
				disabled={disabled}
				onClick={openPicker}
			>
				<CalendarBlankIcon />
			</Button>
			<input
				ref={pickerRef}
				type="date"
				tabIndex={-1}
				aria-hidden="true"
				className="sr-only"
				value={pickerValue}
				disabled={disabled}
				onChange={(event) => {
					if (event.target.value) onChange(event.target.value);
				}}
			/>
		</div>
	);
}
