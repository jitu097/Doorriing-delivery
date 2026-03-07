import dayjs from 'dayjs';

export const formatDate = (value, format = 'DD MMM YYYY, hh:mm A') => dayjs(value).format(format);
