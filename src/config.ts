const env = process.env;

const required = (name: string, developmentDefault: string): string => {
  const value = env[name];
  if (value) return value;
  if (env.NODE_ENV === 'production') throw new Error(`Missing environment variable ${name}`);
  return developmentDefault;
};

export const config = {
  port: Number(env.PORT ?? 3003),
  rabbitmqUrl: env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
  jwtSecret: required('JWT_SECRET', 'local-development-secret'),
  dynamo: {
    region: env.AWS_REGION ?? 'us-east-1',
    endpoint: env.DYNAMODB_ENDPOINT,
    table: env.DYNAMODB_TABLE ?? 'oficina-work-orders',
  },
  newRelicEnabled: Boolean(env.NEW_RELIC_LICENSE_KEY),
};
