interface Props {
  onSelect: (emoji: string) => void;
}

const EMOJIS = ['😀', '😄', '😂', '😍', '😎', '😢', '😡', '👍', '🎉', '❤️', '🔥', '👏'];

export function EmojiPicker({ onSelect }: Props) {
  return (
    <div className="absolute bottom-full mb-2 grid w-52 grid-cols-6 gap-1 rounded-xl border border-[#404249] bg-[#1f2125] p-2 shadow-lg">
      {EMOJIS.map((emoji) => (
        <button
          type="button"
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="flex h-9 items-center justify-center rounded-lg text-lg transition hover:bg-[#2b2f35]"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
