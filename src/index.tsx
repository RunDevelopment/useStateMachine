import { useEffect, useReducer, Dispatch } from 'react';

type KeysOfTransition<Obj> = Obj extends Record<keyof Obj, string> ? keyof Obj : never;

type Transition<TName> =
  | TName
  | {
      target: TName;
      guard?: (context: any) => boolean;
    };

type States<T extends Record<keyof T, { on?: any }>> = {
  [K in keyof T]: {
    on?: Record<keyof NonNullable<T[K]['on']>, Transition<keyof T>>;
    effect?(send: (action: keyof NonNullable<T[K]['on']>) => void): void;
  };
};

function stateNode<TEvents extends Record<keyof TEvents, PropertyKey | Record<'target', PropertyKey>>>(param: {
  on: TEvents;
  effect?: ((send: (action: keyof TEvents) => void) => void) | undefined;
}): typeof param;
function stateNode(param: { effect?: () => void; on?: undefined }): typeof param;
function stateNode<TEvents extends Record<keyof TEvents, PropertyKey>>({
  on,
  effect,
}: {
  on?: TEvents;
  effect?: (send: (action: keyof TEvents) => void) => void;
}) {
  return { ...(on && { on }), ...(effect && { effect }) };
}

export default function useStateMachine<Context extends Record<PropertyKey, any>>(context?: Context) {
  return function useStateMachineWithContext<T extends States<T>>(states: { initial: keyof T; states: T }) {
    const [machine, send] = useReducer(
      (state = { message: '' }, action: KeysOfTransition<NonNullable<T[keyof T]['on']>>) => {
        switch (action) {
          case 'UPDATE_MESSAGE':
            return {
              message: 'hey',
            };
          default:
            return state;
        }
      },
      { foo: true }
    );

    return [machine, send];
  };
}

/////////////////////////

const [machinestate, send] = useStateMachine()({
  initial: 'inactive',
  states: {
    inactive: stateNode({
      on: {
        ACTIVATE: 'active',
      },
    }),
    empty: stateNode({}),
    frozen: stateNode({
      effect() {
        console.log('Entered Frozen');
      },
    }),
    active: stateNode({
      on: {
        DEACTIVATE: 'inactive',
      },
      effect: send => {
        send('DEACTIVATE');
      },
    }),
  },
});
