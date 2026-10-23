#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
void solve(){
    string s;cin>>s;
    vector<int>stk;
    int n=s.size();
    s="&"+s;
    int len=0;
    for(int i=1;i<=n;i++){
        char c=s[i];
        if(c=='('||c==')'){
            if(!stk.empty()&&(s[stk.back()]==')'||s[stk.back()]=='(')) {
                stk.pop_back();
                int nxt=i+1;
                if(nxt<=n){ 
                    if((s[nxt]=='('||s[nxt]==')')&&(s[i]=='('||s[i]==')')){
                        cout<<"No"<<endl;
                        return;
                    }
                }
            }
            else stk.emplace_back(i);
            
        }
        else{
            if(!stk.empty()&&(s[stk.back()]==']'||s[stk.back()]=='[')) {
                stk.pop_back();
                int nxt=i+1;
                if(nxt<=n){ 
                    if((s[nxt]=='['||s[nxt]==']')&&(s[i]=='['||s[i]==']')){
                        cout<<"No"<<endl;
                        return;
                    }
                }
            }
            else stk.emplace_back(i);
        }
        if(stk.empty()) ++len;
    }
    if(len>=3) cout<<"No"<<endl;
    else cout<<"Yes"<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T=1;cin>>T;
    while(T--) solve();
    return 0;
}