declare module "input" {
  interface InputOptions {
    text(prompt: string): Promise<string>
  }
  const input: InputOptions
  export = input
}
