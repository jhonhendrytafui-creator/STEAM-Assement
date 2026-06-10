async function test() {
    const res = await fetch("https://docs.google.com/document/d/1_9iE2z0RjBfO2q1lP7V3A2bU1qWbT-qP4T_V_F1o0g/export?format=txt", { redirect: 'follow' });
    console.log(res.headers);
    for (let [key, value] of res.headers.entries()) {
        console.log(key, value);
    }
}
test();
