// Время в симуляторе — «локальное время организации» вида ГГГГ-ММ-ДДTчч:мм, как значение
// <input type="datetime-local">, без секунд и часового пояса (docs/adr/0001-time-representation.md).
// Строки фиксированной ширины сравниваются лексикографически в порядке моментов.

export type LocalDateTime = string;

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export const isLocalDateTime = (value: unknown): value is LocalDateTime => {
  if (typeof value !== "string") {
    return false;
  }
  const match = PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day, hours, minutes] = match.slice(1).map(Number);
  // Календарь проверяется арифметикой: модуль расчёта не создаёт Date вовсе.
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return daysInMonth !== undefined && day >= 1 && day <= daysInMonth && hours < 24 && minutes < 60;
};

const pad = (value: number): string => String(value).padStart(2, "0");

/** Переводит переданный момент в строку по локальным часам. Часы не читает: момент приходит снаружи. */
export const formatLocalDateTime = (date: Date): LocalDateTime =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
